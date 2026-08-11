import mongoose from "mongoose";
import { config } from "../config/env.js";
import { processPDF, processYouTube, processWeb } from '../loaders/index.js';
import { Workspace } from "../models/Workspace.js";
import { getVectorStore } from "./qdrant.service.js";

/**
 * 1. Verify workspace exists and belongs to the user
 */
export async function verifyWorkspace(workspaceId, userId) {
  const workspaceDoc = await Workspace.findOne({ workspaceId, userId });
  if (!workspaceDoc) {
    const error = new Error(`Workspace with ID '${workspaceId}' does not exist. Please create a workspace first.`);
    error.statusCode = 404;
    throw error;
  }
  return workspaceDoc;
}

/**
 * 2. Delegate loading, parsing, Cloudinary uploading (if PDF), and chunking to source handlers
 */
export async function loadAndChunkDocument(sourcePayload) {
  if (sourcePayload.type === "pdf") {
    return await processPDF(sourcePayload.filePath, sourcePayload.originalName);
  }

  if (sourcePayload.type === "youtube") {
    return await processYouTube(sourcePayload.url);
  }

  if (sourcePayload.type === "website") {
    return await processWeb(sourcePayload.url);
  }

  throw new Error(`Unsupported document source type: '${sourcePayload.type}'`);
}

/**
 * 3. Enrich text chunks with workspace, user, and source metadata
 */
export function enrichChunks(chunks, sourcePayload, metadata) {
  return chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      sourceId: metadata.sourceId,
      title: metadata.title,
      workspaceId: sourcePayload.workspaceId,
      userId: String(sourcePayload.userId),
      sourceType: sourcePayload.type,
      sourceUrl: metadata.sourceUrl,
      cloudinaryUrl: metadata.cloudinaryUrl || null,
      publicId: metadata.publicId || null,
      indexedAt: new Date().toISOString(),
    },
  }));
}

/**
 * 4. Embed enriched text chunks and batch upload vectors to Qdrant Vector Store
 */
export async function embedDocuments(enrichedChunks) {
  console.log("[Indexer] Connecting to Qdrant Vector Store...");
  const vectorStore = await getVectorStore();

  const BATCH_SIZE = config.BATCH_SIZE || 100;
  console.log(`[Indexer] Uploading ${enrichedChunks.length} chunks to Qdrant in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < enrichedChunks.length; i += BATCH_SIZE) {
    const batch = enrichedChunks.slice(i, i + BATCH_SIZE);
    await vectorStore.addDocuments(batch);
    console.log(`  → Indexed batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(enrichedChunks.length / BATCH_SIZE)}`);
  }
}

/**
 * 5. Persist source metadata into MongoDB Workspace collection
 */
export async function saveSourceToWorkspace(workspaceId, userId, sourceMetadata) {
  return await Workspace.findOneAndUpdate(
    { workspaceId, userId },
    {
      $addToSet: {
        sources: {
          sourceId: sourceMetadata.sourceId,
          title: sourceMetadata.title,
          sourceType: sourceMetadata.sourceType,
          sourceUrl: sourceMetadata.sourceUrl,
          cloudinaryUrl: sourceMetadata.cloudinaryUrl || null,
          videoId: sourceMetadata.videoId || null,
        },
      },
    },
    { returnDocument: 'after' }
  );
}

/**
 * Main Orchestrator Pipeline Function (used synchronously or inside Inngest workers)
 * @param {Object} sourcePayload - Source payload containing type, workspaceId, userId, filePath/url, originalName
 */
export async function processAndIndexDocument(sourcePayload) {
  // Step 1: Verify Workspace
  await verifyWorkspace(sourcePayload.workspaceId, sourcePayload.userId);

  console.log(`[Indexer] Processing document for type: ${sourcePayload.type}...`);

  // Step 2: Load & Chunk Document
  const docResult = await loadAndChunkDocument(sourcePayload);

  // Generate unique sourceId for this source
  const sourceId = new mongoose.Types.ObjectId().toString();
  const sourceData = { ...docResult, sourceId };

  // Step 3: Enrich Metadata
  const enrichedChunks = enrichChunks(docResult.chunks, sourcePayload, sourceData);

  // Step 4: Embed & Store Vectors in Qdrant
  await embedDocuments(enrichedChunks);

  // Step 5: Save Source Metadata to MongoDB
  await saveSourceToWorkspace(sourcePayload.workspaceId, sourcePayload.userId, {
    sourceId: sourceId,
    title: docResult.title,
    sourceType: sourcePayload.type,
    sourceUrl: docResult.sourceUrl,
    cloudinaryUrl: docResult.cloudinaryUrl || null,
    videoId: docResult.videoId || null,
  });

  return {
    success: true,
    sourceId: sourceId,
    chunksIndexed: enrichedChunks.length,
    sourceType: sourcePayload.type,
    title: docResult.title,
    sourceUrl: docResult.sourceUrl,
    cloudinaryUrl: docResult.cloudinaryUrl || null,
    publicId: docResult.publicId || null,
  };
}