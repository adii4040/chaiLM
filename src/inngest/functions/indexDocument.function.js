import mongoose from "mongoose";
import { inngest } from "../client.js";
import {
  verifyWorkspace,
  loadAndChunkDocument,
  enrichChunks,
  embedDocuments,
  saveSourceToWorkspace,
  updateSourceStatus,
  removeSourceFromWorkspace,
} from "../../services/indexer.service.js";

/**
 * Inngest background job function to handle document ingestion asynchronously.
 * Listens for event: 'document/index.requested'
 */
export const indexDocumentFunction = inngest.createFunction(
  {
    id: "index-document-pipeline",
    name: "Index Document Ingestion Pipeline",
    retries: 3,
    triggers: [{ event: "document/index.requested" }],
    onFailure: async ({ event, error }) => {
      const originalData = event.data.event.data;
      const { workspaceId, userId, sourceId } = originalData;
      if (workspaceId && userId && sourceId) {
        console.error(`[Inngest Failure] Removing failed source ${sourceId} from workspace ${workspaceId}:`, error.message);
        await removeSourceFromWorkspace(workspaceId, userId, sourceId);
      }
    },
  },
  async ({ event, step }) => {
    const { workspaceId, userId, type, url, filePath, originalName, sourceId } = event.data;

    // Step 1: Verify Workspace Existence
    await step.run("verify-workspace", async () => {
      return await verifyWorkspace(workspaceId, userId);
    });

    // Step 2: Mark Source Status as PROCESSING in MongoDB
    if (sourceId) {
      await step.run("mark-status-processing", async () => {
        return await updateSourceStatus(workspaceId, userId, sourceId, "PROCESSING");
      });
    }

    // Step 3: Load, Scrap (Firecrawl/PDF/YouTube), & Chunk Document
    const docResult = await step.run("load-and-chunk-document", async () => {
      return await loadAndChunkDocument({ type, filePath, url, originalName });
    });

    // Step 4: Embed Text & Upload Vectors to Qdrant
    const enrichedResult = await step.run("embed-and-upload-qdrant", async () => {
      const finalSourceId = sourceId || new mongoose.Types.ObjectId().toString();
      const sourceData = { ...docResult, sourceId: finalSourceId };
      const enriched = enrichChunks(docResult.chunks, event.data, sourceData);
      await embedDocuments(enriched);
      return { sourceId: finalSourceId, chunksIndexed: enriched.length };
    });

    // Step 5: Save Source Metadata into MongoDB Workspace & set status to COMPLETED
    await step.run("save-source-mongodb", async () => {
      return await saveSourceToWorkspace(workspaceId, userId, {
        sourceId: enrichedResult.sourceId,
        title: docResult.title,
        sourceType: type,
        sourceUrl: docResult.sourceUrl,
        cloudinaryUrl: docResult.cloudinaryUrl || null,
        videoId: docResult.videoId || null,
      });
    });

    return {
      success: true,
      workspaceId,
      sourceId: enrichedResult.sourceId,
      chunksIndexed: enrichedResult.chunksIndexed,
      sourceType: type,
      title: docResult.title,
      sourceUrl: docResult.sourceUrl,
      cloudinaryUrl: docResult.cloudinaryUrl || null,
    };
  }
);
