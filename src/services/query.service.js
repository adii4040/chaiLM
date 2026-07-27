// src/services/query.service.js
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { config } from "../config/env.js";
import { translateQuery } from "./llm.service.js";
import { generateHyDeDocument } from "./hyde.service.js";
import { reciprocalRankFusion } from "../utils/rrf.js";
import { buildPrompt } from "../prompt/buildPrompt.js";
import { rerankCandidates } from "./reranker.service.js";
import { StructuredFinalResponseSchema } from "../utils/responseSchema.utils.js";

const embeddings = new OpenAIEmbeddings({
  model: config.openai.embeddingModel,
  apiKey: config.openai.apiKey,
});

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Converts total seconds into HH:MM:SS format
 */
function formatSecondsToTimestamp(totalSeconds = 0) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  const hh = String(hrs).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

export async function processQueryPipeline({ query, sessionId, selectedSourceIds = [] }) {
  // 1. Instantiate vector store
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: config.qdrant.url,
    collectionName: config.qdrant.collection,
  });

  // 2. Fetch session title hint for HyDE
  let sourceTitleHint = "";
  try {
    const sampleDocs = await vectorStore.similaritySearch("", 1, {
      must: [
        { key: "metadata.sessionId", match: { value: sessionId } },
        ...(selectedSourceIds.length > 0
          ? [{ key: "metadata.sourceUrl", match: { any: selectedSourceIds } }]
          : []),
      ],
    });

    if (sampleDocs.length > 0 && sampleDocs[0].metadata?.title) {
      sourceTitleHint = sampleDocs[0].metadata.title;
    }
  } catch (err) {
    console.warn("Title hint fetch failed:", err.message);
  }

  // 3. Parallel Expansion + HyDE
  const [translations, hydePassage] = await Promise.all([
    translateQuery(query),
    generateHyDeDocument(query, sourceTitleHint),
  ]);

  // 4. Build search requests
  const searchRequests = [
    { type: "original", query },
    { type: "rewritten", query: translations.rewritten },
    { type: "stepBack", query: translations.stepBack },
    { type: "hyde", query: hydePassage },
    ...translations.subQueries.map((subQ, i) => ({
      type: `subQuery_${i + 1}`,
      query: subQ,
    })),
  ];

  // 5. Scoped Qdrant filter
  const mustFilters = [
    { key: "metadata.sessionId", match: { value: sessionId } },
  ];
  if (selectedSourceIds.length > 0) {
    mustFilters.push({ key: "metadata.sourceUrl", match: { any: selectedSourceIds } });
  }

  const vectorRetriever = vectorStore.asRetriever({
    k: 5,
    filter: { must: mustFilters },
  });

  // 6. Parallel retrieval
  const retrievalResults = await Promise.all(
    searchRequests.map(async (request) => ({
      type: request.type,
      query: request.query,
      docs: await vectorRetriever.invoke(request.query),
    }))
  );

  // 7. RRF Fusion (Top 15 candidate pool)
  const fusedCandidates = reciprocalRankFusion(retrievalResults, {
    k: 60,
    topK: 15,
  });

  if (fusedCandidates.length === 0) {
    return {
      query,
      answer: {
        summary: "I couldn't find any relevant information in your workspace.",
        segments: [],
      },
      translations,
      sources: [],
    };
  }

  // 8. Cross-Encoder Reranking (Top 5)
  const finalChunks = await rerankCandidates(query, fusedCandidates, 5);

  // 9. Structured Answer Synthesis via Zod Schema
  const systemInstruction = buildPrompt(finalChunks);

  const response = await openai.chat.completions.parse({
    model: config.openai.chatModel || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: query },
    ],
    response_format: zodResponseFormat(
      StructuredFinalResponseSchema,
      "rag_answer_response"
    ),
  });

  const parsedAnswer = response.choices[0].message.parsed;

  // 10. Format Sources with structured timestamp objects & direct YouTube deep links
  const formattedSources = finalChunks.map((item) => {
    const startSecs = item.startSeconds || 0;
    const formattedTs = formatSecondsToTimestamp(startSecs);
    const videoId = item.videoId || "";
    const isYoutube = item.sourceType === "youtube";

    const timeUrl = isYoutube && videoId
      ? `https://youtu.be/${videoId}?t=${startSecs}s`
      : item.sourceUrl || "";

    return {
      text: item.pageContent,
      sourceType: item.sourceType || "document",
      sourceUrl: item.sourceUrl,
      title: item.title,
      pageNumber: item.pageNumber || item.document?.metadata?.pageNumber || null,
      videoId: item.videoId || null,
      timestamp: isYoutube ? {
        startSeconds: startSecs,
        formattedTimestamp: formattedTs,
        timeUrl: timeUrl,
      } : null,
      rrfScore: item.score,
      rerankScore: item.rerankScore,
    };
  });

  return {
    query,
    answer: parsedAnswer,
    translations,
    hyde: hydePassage,
    sources: formattedSources,
  };
}