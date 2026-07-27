import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { config } from "../config/env.js";
import { loadPDF } from "../loaders/pdf.loader.js";
import { loadYoutubeTranscript } from "../loaders/youtube.loader.js";
import { loadWeb } from "../loaders/web.loader.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.utils.js";

const embeddings = new OpenAIEmbeddings({
  model: config.openai.embeddingModel,
  apiKey: config.openai.apiKey,
});

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

  // 1. Extract/Parse raw document content
  const rawDocs = await loadDocuments(sourcePayload);

  let cloudinaryResult = null;
  let sourceUrl = sourcePayload.url || sourcePayload.originalName || sourcePayload.filePath;

  // 2. If PDF source, upload local temp file to Cloudinary
  if (sourcePayload.type === "pdf" && sourcePayload.filePath) {
    console.log("[Indexer] Uploading PDF file to Cloudinary...");
    cloudinaryResult = await uploadOnCloudinary(sourcePayload.filePath);

    if (!cloudinaryResult) {
      throw new Error("Failed to upload PDF file to Cloudinary");
    }

    sourceUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
    console.log(`[Indexer] Cloudinary upload successful: ${sourceUrl}`);
  }

  let chunks;

  if (sourcePayload.type === "youtube") {
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

  console.log(`[Indexer] Enriching metadata for ${chunks.length} chunks (sessionId: ${sourcePayload.sessionId})...`);

  const enrichedChunks = chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      title: documentTitle,
      sessionId: sourcePayload.sessionId,
      sourceType: sourcePayload.type,
      sourceUrl: sourceUrl,
      cloudinaryUrl: cloudinaryResult?.secure_url || null,
      publicId: cloudinaryResult?.public_id || null,
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
    cloudinaryUrl: cloudinaryResult?.secure_url || null,
    publicId: cloudinaryResult?.public_id || null,
  };
}

/**
 * Retrieves list of indexed document sources for a specific session ID
 */
export async function getDocumentsBySession(sessionId) {
  try {
    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: config.qdrant.url,
      collectionName: config.qdrant.collection,
    });

    const docs = await vectorStore.similaritySearch("", 100, {
      must: [{ key: "metadata.sessionId", match: { value: sessionId } }],
    });

    const uniqueMap = new Map();
    for (const doc of docs) {
      const meta = doc.metadata || {};
      const key = meta.sourceUrl || meta.title || meta.source;
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, {
          title: meta.title || "Untitled Document",
          sourceType: meta.sourceType || "document",
          sourceUrl: meta.sourceUrl || meta.source || "",
          cloudinaryUrl: meta.cloudinaryUrl || null,
          indexedAt: meta.indexedAt || null,
        });
      }
    }

    return Array.from(uniqueMap.values());
  } catch (error) {
    console.error("Error retrieving session documents:", error);
    return [];
  }
}