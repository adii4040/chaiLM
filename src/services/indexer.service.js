import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { config } from "../config/env.js";
import { loadPDF } from "../loaders/pdf.loader.js";
import { loadYoutubeTranscript } from "../loaders/youtube.loader.js";
import { loadWeb } from "../loaders/web.loader.js";

const embeddings = new OpenAIEmbeddings({
  model: config.openai.embeddingModel,
  apiKey: config.openai.apiKey,
});

/**
 * Dispatcher to route document loader based on source type (PDF, YouTube, Website)
 */
async function loadDocuments(source) {
  if (source.type === "pdf") {
    return await loadPDF(source.filePath, source.originalName);
  }

  if (source.type === "youtube") {
    return await loadYoutubeTranscript(source.url);
  }

  if (source.type === "website") {
    return await loadWeb(source.url);
  }

  throw new Error(`Unsupported document source type: '${source.type}'`);
}

/**
 * Ingestion Pipeline for indexing PDF documents, YouTube transcripts, and Web pages into Qdrant
 * @param {Object} sourcePayload - Source payload containing type, sessionId, filePath/url, originalName
 */
export async function processAndIndexDocument(sourcePayload) {
  console.log(`[Indexer] Loading documents for type: ${sourcePayload.type}...`);
  const rawDocs = await loadDocuments(sourcePayload);

  let chunks;

  if (sourcePayload.type === "youtube") {
    // YouTube loader already handles chunking with accurate per-segment startSeconds timestamps.
    console.log("[Indexer] YouTube content detected. Skipping secondary splitter to preserve timestamp integrity.");
    chunks = rawDocs;
  } else {
    console.log("[Indexer] Splitting document content into text chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunking.chunkSize || 600,
      chunkOverlap: config.chunking.chunkOverlap || 150,
    });

    chunks = await splitter.splitDocuments(rawDocs);
  }

  const documentTitle =
    sourcePayload.originalName ||
    rawDocs[0]?.metadata?.title ||
    sourcePayload.url ||
    "Untitled Document";

  const sourceUrl =
    sourcePayload.url ||
    sourcePayload.originalName ||
    sourcePayload.filePath;

  console.log(`[Indexer] Enriching metadata for ${chunks.length} chunks (sessionId: ${sourcePayload.sessionId})...`);

  const enrichedChunks = chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      title: documentTitle,
      sessionId: sourcePayload.sessionId,
      sourceType: sourcePayload.type,
      sourceUrl: sourceUrl,
      indexedAt: new Date().toISOString(),
    },
  }));

  console.log("[Indexer] Connecting to Qdrant Vector Store...");
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: config.qdrant.url,
    collectionName: config.qdrant.collection,
  });

  const BATCH_SIZE = 100;
  console.log(`[Indexer] Uploading ${enrichedChunks.length} chunks to Qdrant in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < enrichedChunks.length; i += BATCH_SIZE) {
    const batch = enrichedChunks.slice(i, i + BATCH_SIZE);
    await vectorStore.addDocuments(batch);
    console.log(`  → Indexed batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(enrichedChunks.length / BATCH_SIZE)}`);
  }

  return {
    success: true,
    chunksIndexed: enrichedChunks.length,
    sourceType: sourcePayload.type,
    title: documentTitle,
    sourceUrl: sourceUrl,
  };
}