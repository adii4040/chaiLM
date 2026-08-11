import { config } from "../config/env.js";
import { translateQuery } from "./llm.service.js";
import { generateHyDeDocument } from "./hyde.service.js";
import { reciprocalRankFusion } from "../utils/rrf.js";
import { rerankDocuments } from "./reranker.service.js";
import { generateStructuredRAGResponse } from "./ragGenerator.service.js";
import { formatSecondsToTimestamp } from "../utils/timestampFormatter.utils.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { Workspace } from "../models/Workspace.js";
import { getVectorStore } from "./qdrant.service.js";

export async function processQueryPipeline({ query, workspaceId, userId, selectedSourceIds = [] }) {
  // 1. Verify workspace exists before doing any processing
  const workspaceDoc = await Workspace.findOne({ workspaceId, userId });
  if (!workspaceDoc) {
    const error = new Error(`Workspace with ID '${workspaceId}' does not exist or access is unauthorized.`);
    error.statusCode = 404;
    throw error;
  }

  // 2. Verify workspace has indexed sources
  if (!workspaceDoc.sources || workspaceDoc.sources.length === 0) {
    const error = new Error(`Workspace '${workspaceId}' has no indexed sources. Please index a document first.`);
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate selectedSourceIds (MongoDB Object IDs) against workspace sources
  let targetSourceFilters = [];
  if (selectedSourceIds.length > 0) {
    const missingSourceIds = selectedSourceIds.filter((id) => {
      return !workspaceDoc.sources.some(
        (s) => s.sourceId === id || (s._id && s._id.toString() === id)
      );
    });

    if (missingSourceIds.length > 0) {
      const error = new Error(`Selected source(s) [${missingSourceIds.join(", ")}] are not present in the current workspace.`);
      error.statusCode = 404;
      throw error;
    }

    targetSourceFilters = selectedSourceIds.flatMap((id) => {
      const match = workspaceDoc.sources.find(
        (s) => s.sourceId === id || (s._id && s._id.toString() === id)
      );
      return match ? [match.sourceUrl, match.sourceId || match._id?.toString()] : [id];
    }).filter(Boolean);
  }

  const sourceFilterCondition = targetSourceFilters.length > 0
    ? [{ key: "metadata.sourceUrl", match: { any: targetSourceFilters } }]
    : [];

  // 4. Instantiate vector store via Qdrant service
  const vectorStore = await getVectorStore();

  // 5. Fetch workspace title hint for HyDE
  let sourceTitleHint = "";
  try {
    const sampleDocs = await vectorStore.similaritySearch("", 1, {
      must: [
        { key: "metadata.workspaceId", match: { value: workspaceId } },
        ...sourceFilterCondition,
      ],
    });

    if (sampleDocs.length > 0 && sampleDocs[0].metadata?.title) {
      sourceTitleHint = sampleDocs[0].metadata.title;
    }
  } catch (err) {
    console.warn("Title hint fetch failed:", err.message);
  }

  // 6. Parallel Expansion + HyDE
  const [translations, hydePassage] = await Promise.all([
    translateQuery(query),
    generateHyDeDocument(query, sourceTitleHint),
  ]);

  // 7. Build search requests
  const searchRequests = [
    { type: "original", query },
    { type: "rewritten", query: translations.rewritten },
    { type: "stepBack", query: translations.stepBack },
    ...(translations.subQueries || []).map((sq) => ({ type: "subQuery", query: sq })),
    { type: "hyde", query: hydePassage },
  ];

  // 8. Configure Vector Retriever
  const vectorRetriever = vectorStore.asRetriever({
    k: config.retrieval.vectorTopK || 10,
    filter: {
      must: [
        { key: "metadata.workspaceId", match: { value: workspaceId } },
        ...sourceFilterCondition,
      ],
    },
  });

  // 9. Execute Multi-Angle Parallel Retrieval
  const retrievalPromises = searchRequests.map(async (req) => {
    try {
      const docs = await vectorRetriever.invoke(req.query);
      return { type: req.type, docs };
    } catch (err) {
      console.warn(`Retrieval failed for type [${req.type}]:`, err.message);
      return { type: req.type, docs: [] };
    }
  });

  const retrievalResults = await Promise.all(retrievalPromises);

  // 10. Combine & Deduplicate via Reciprocal Rank Fusion (RRF) with Dynamic TopK
  const numSources = selectedSourceIds.length > 0
    ? selectedSourceIds.length
    : (workspaceDoc.sources?.length || 1);

  const dynamicTopK = Math.max(20, numSources * 5);

  const fusedDocs = reciprocalRankFusion(
    retrievalResults,
    { k: config.retrieval.rrfK || 60, topK: dynamicTopK }
  );

  // 11. Source-Balanced Chunk Selection (Extract top chunks for EVERY target sourceId)
  const targetSources = selectedSourceIds.length > 0
    ? selectedSourceIds
    : workspaceDoc.sources.map((s) => s.sourceId || s._id?.toString() || s.sourceUrl);

  const chunksBySource = new Map();
  for (const doc of fusedDocs) {
    const sId = doc.sourceId || doc.document?.metadata?.sourceId || doc.sourceUrl;
    if (!chunksBySource.has(sId)) {
      chunksBySource.set(sId, []);
    }
    chunksBySource.get(sId).push(doc);
  }

  const balancedCandidates = [];
  for (const sId of targetSources) {
    const sourceChunks = (chunksBySource.get(sId) || []).concat(
      fusedDocs.filter((d) => d.sourceUrl === sId || d.document?.metadata?.sourceUrl === sId)
    );
    const uniqueSourceChunks = Array.from(new Set(sourceChunks));
    if (uniqueSourceChunks.length > 0) {
      // Prioritize Page 1 chunk if it's a PDF so primary resume context is preserved
      const page1Index = uniqueSourceChunks.findIndex(
        (c) => (c.startSeconds === 1 || c.document?.metadata?.loc?.pageNumber === 1) && c.sourceType === "pdf"
      );
      if (page1Index > 0) {
        const [page1Chunk] = uniqueSourceChunks.splice(page1Index, 1);
        uniqueSourceChunks.unshift(page1Chunk);
      }
      balancedCandidates.push(...uniqueSourceChunks.slice(0, 5));
    }
  }

  const topChunksToRerank = balancedCandidates.length > 0 ? balancedCandidates : fusedDocs.slice(0, 15);

  // 12. Rerank retrieved candidate chunks using Cohere Cross-Encoder v3.5
  const rerankedDocs = await rerankDocuments(
    query,
    topChunksToRerank,
    config.retrieval.finalTopK || topChunksToRerank.length
  );

  const finalChunks = rerankedDocs.length > 0 ? rerankedDocs : topChunksToRerank;

  // 13. Synthesize final NotebookLM-style sectioned response with citations
  const parsedAnswer = await generateStructuredRAGResponse(query, finalChunks);

  // 14. Format Sources with structured timestamp objects & direct YouTube deep links
  const formattedSources = finalChunks.map((item) => {
    const startSecs = item.startSeconds || 0;
    const formattedTs = formatSecondsToTimestamp(startSecs);
    const videoId = item.videoId || "";
    const isYoutube = item.sourceType === "youtube";

    const timeUrl = isYoutube && videoId
      ? `https://youtu.be/${videoId}?t=${startSecs}s`
      : item.sourceUrl || "";

    return {
      sourceId: item.sourceId || item.document?.metadata?.sourceId || null,
      text: item.pageContent,
      sourceType: item.sourceType || "document",
      sourceUrl: item.sourceUrl || item.document?.metadata?.sourceUrl || item.document?.metadata?.cloudinaryUrl || "",
      cloudinaryUrl: item.document?.metadata?.cloudinaryUrl || item.cloudinaryUrl || (item.sourceUrl?.startsWith('http') ? item.sourceUrl : null),
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

  // Persist User Query and Assistant Response to MongoDB ChatMessage collection with userId scope
  try {
    await ChatMessage.create({
      workspaceId,
      userId,
      role: "user",
      query: query,
    });

    await ChatMessage.create({
      workspaceId,
      userId,
      role: "assistant",
      answer: parsedAnswer,
      sources: formattedSources,
    });
  } catch (err) {
    console.error("[Query Pipeline] Failed to persist ChatMessages to MongoDB:", err);
  }

  return {
    query,
    answer: parsedAnswer,
    translations,
    hyde: hydePassage,
    sources: formattedSources,
  };
}