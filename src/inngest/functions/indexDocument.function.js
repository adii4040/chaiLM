import mongoose from "mongoose";
import { inngest } from "../client.js";
import {
  verifyWorkspace,
  loadAndChunkDocument,
  enrichChunks,
  embedDocuments,
  saveSourceToWorkspace,
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
  },
  async ({ event, step }) => {
    const { workspaceId, userId, type, url, filePath, originalName } = event.data;

    // Step 1: Verify Workspace Existence
    await step.run("verify-workspace", async () => {
      return await verifyWorkspace(workspaceId, userId);
    });

    // Step 2: Load, Scrap (Firecrawl/PDF/YouTube), & Chunk Document
    const docResult = await step.run("load-and-chunk-document", async () => {
      return await loadAndChunkDocument({ type, filePath, url, originalName });
    });

    // Step 3: Embed Text & Upload Vectors to Qdrant
    const enrichedResult = await step.run("embed-and-upload-qdrant", async () => {
      const sourceId = new mongoose.Types.ObjectId().toString();
      const sourceData = { ...docResult, sourceId };
      const enriched = enrichChunks(docResult.chunks, event.data, sourceData);
      await embedDocuments(enriched);
      return { sourceId, chunksIndexed: enriched.length };
    });

    // Step 4: Save Source Metadata into MongoDB Workspace
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
