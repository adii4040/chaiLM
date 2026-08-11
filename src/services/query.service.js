import { config } from "../config/env.js";
import {
  translateQuery,
  generateHyDeDocument,
  rerankDocuments,
  generateStructuredRAGResponse
} from "./ai/index.js";
import { reciprocalRankFusion } from "../utils/rrf.utils.js";
import { formatSecondsToTimestamp } from "../utils/timestampFormatter.utils.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { Workspace } from "../models/Workspace.js";
import { getVectorStore } from "../lib/index.js";

export async function verifyWorkSpace(workspaceId, userId) {
  const workspaceDoc = await Workspace.findOne({ workspaceId, userId });
  if (!workspaceDoc) {
    const error = new Error(`Workspace with ID '${workspaceId}' does not exist or access is unauthorized.`);
    error.statusCode = 404;
    throw error;
  }

  if (!workspaceDoc.sources || workspaceDoc.sources.length === 0) {
    const error = new Error(`Workspace '${workspaceId}' has no indexed sources. Please index a document first.`);
    error.statusCode = 400;
    throw error;
  }


  return workspaceDoc;
}


export async function getSourceFilters(workspaceDoc, selectedSourceIds = []) {
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
  return targetSourceFilters;
}


export async function getQueryTranslation({ vectorStore, query, workspaceId, sourceFilterCondition }) {
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

  // Generate translations and HyDE document in parallel
  const [translations, hydePassage] = await Promise.all([
    translateQuery(query),
    generateHyDeDocument(query, sourceTitleHint),
  ]);

  return { translations, hydePassage };
}


export async function retrieveChunks({ vectorStore, query, workspaceId, sourceFilterCondition, translations, hydePassage }) {
  const searchRequests = [
    { type: "original", query },
    { type: "rewritten", query: translations.rewritten },
    { type: "stepBack", query: translations.stepBack },
    ...(translations.subQueries || []).map((sq) => ({ type: "subQuery", query: sq })),
    { type: "hyde", query: hydePassage },
  ];

  const vectorRetriever = vectorStore.asRetriever({
    k: config.retrieval.vectorTopK || 10,
    filter: {
      must: [
        { key: "metadata.workspaceId", match: { value: workspaceId } },
        ...sourceFilterCondition,
      ],
    },
  });

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
  return retrievalResults;
}


export async function getTopChunksToReRank({ selectedSourceIds, workspaceDoc, retrievalResults }) {
  // Combine and deduplicate retrieval sets via Reciprocal Rank Fusion (RRF) with dynamic topK
  const numSources = selectedSourceIds.length > 0
    ? selectedSourceIds.length
    : (workspaceDoc.sources?.length || 1);

  const dynamicTopK = Math.max(20, numSources * 5);

  const fusedDocs = reciprocalRankFusion(
    retrievalResults,
    { k: config.retrieval.rrfK || 60, topK: dynamicTopK }
  );

  // Source-Balanced Chunk Selection (Extract top chunks for every target sourceId to ensure representation)
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

  return balancedCandidates.length > 0 ? balancedCandidates : fusedDocs.slice(0, 15);
}


export async function formatSources(finalChunks) {
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

  return formattedSources;
}


export async function processQueryPipeline({ query, workspaceId, userId, selectedSourceIds = [] }) {
  // 1. Verify workspace exists and user has access before doing any processing
  const workspaceDoc = await verifyWorkSpace(workspaceId, userId);

  // 2. Resolve and validate selectedSourceIds against workspace sources
  const targetSourceFilters = await getSourceFilters(workspaceDoc, selectedSourceIds);

  // 3. Build source filtering conditions for the vector database query
  const sourceFilterCondition = targetSourceFilters.length > 0
    ? [{ key: "metadata.sourceUrl", match: { any: targetSourceFilters } }]
    : [];

  // 4. Connect to Qdrant vector store
  const vectorStore = await getVectorStore();

  // 5. Translate query, expand, and generate HyDE document in parallel
  const { translations, hydePassage } = await getQueryTranslation({ vectorStore, query, workspaceId, sourceFilterCondition });

  // 6. Retrieve relevant chunks for all variations (original, translations, subqueries, HyDE)
  const retrievalResults = await retrieveChunks({ vectorStore, query, workspaceId, sourceFilterCondition, translations, hydePassage });

  // 7. Merge, deduplicate, and select balanced candidates using RRF
  const topChunksToRerank = await getTopChunksToReRank({ selectedSourceIds, workspaceDoc, retrievalResults });

  // 8. Rerank candidate chunks using Cohere Cross-Encoder v3.5
  const rerankedDocs = await rerankDocuments(
    query,
    topChunksToRerank,
    config.retrieval.finalTopK || topChunksToRerank.length
  );

  const finalChunks = rerankedDocs.length > 0 ? rerankedDocs : topChunksToRerank;

  // 9. Synthesize final structured response with citations
  const parsedAnswer = await generateStructuredRAGResponse(query, finalChunks);

  // 10. Format citations/sources with structured metadata & deep links
  const formattedSources = await formatSources(finalChunks);

  // 11. Persist user query and assistant response to MongoDB ChatMessage collection in parallel
  try {
    await Promise.all([
      ChatMessage.create({
        workspaceId,
        userId,
        role: "user",
        query: query,
      }),
      ChatMessage.create({
        workspaceId,
        userId,
        role: "assistant",
        answer: parsedAnswer,
        sources: formattedSources,
      })
    ]);
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