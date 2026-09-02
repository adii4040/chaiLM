import { inngest } from "../client.js";
import { loadUnitsForSource } from "../../services/studioUnitLoader.service.js";
import { createBatches } from "../../utils/batchUnits.utils.js";
import { extractBatchSegments } from "../../services/ai/outlineExtractor.service.js";
import { reconcileOutline } from "../../services/ai/outlineMerge.service.js";
import { updateStudioOutlineStatus, saveStudioOutline } from "../../services/indexer.service.js";
import { Workspace } from "../../models/Workspace.model.js";

/**
 * Inngest background job function for Studio Master Outline extraction.
 * Listens for event: 'studio/outline.requested'
 * Decoupled from Chat Q&A vector indexing.
 */
export const extractStudioOutlineFunction = inngest.createFunction(
  {
    id: "extract-studio-outline-pipeline",
    name: "Extract Studio Outline Pipeline",
    retries: 2,
    triggers: [{ event: "studio/outline.requested" }],
    onFailure: async ({ event, error }) => {
      const originalData = event.data?.event?.data || event.data;
      const { workspaceId, userId, sourceId } = originalData || {};
      if (workspaceId && userId && sourceId) {
        console.error(`[Inngest Studio Outline Failure] Failed for source ${sourceId} in workspace ${workspaceId}:`, error.message);
        await updateStudioOutlineStatus(workspaceId, userId, sourceId, "FAILED", error.message);
      }
    },
  },
  async ({ event, step }) => {
    const { workspaceId, userId, sourceId, type, url, filePath, originalName } = event.data;

    // Step 1: Mark Studio status as PROCESSING
    if (sourceId) {
      await step.run("mark-studio-processing", async () => {
        return await updateStudioOutlineStatus(workspaceId, userId, sourceId, "PROCESSING");
      });
    }

    // Step 2: For PDF, wait until Cloudinary upload finishes and remote URL is available in DB
    let targetPdfUrl = url;
    if (type === "pdf") {
      targetPdfUrl = await step.run("wait-for-pdf-upload", async () => {
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
          return url;
        }

        const maxAttempts = 30;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const workspace = await Workspace.findOne({
            workspaceId,
            "sources.sourceId": sourceId,
          });

          const source = workspace?.sources?.find((s) => s.sourceId === sourceId);
          if (!source) {
            throw new Error(`Source ${sourceId} not found in workspace ${workspaceId}`);
          }

          if (source.status === "FAILED") {
            throw new Error(`PDF indexing failed: ${source.errorMessage || "Upload error"}`);
          }

          const candidateUrl = source.cloudinaryUrl || source.sourceUrl;
          if (candidateUrl && (candidateUrl.startsWith("http://") || candidateUrl.startsWith("https://"))) {
            console.log(`[Studio Pipeline] Successfully obtained Cloudinary PDF URL for source ${sourceId}: ${candidateUrl}`);
            return candidateUrl;
          }

          console.log(`[Studio Pipeline] Waiting for Cloudinary PDF upload to complete for source ${sourceId} (attempt ${attempt}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        throw new Error(`Timed out waiting for PDF Cloudinary URL for source ${sourceId}`);
      });
    }

    // Step 3: Extract & Reconcile in RAM (Lean step: only the final compact outline ~2KB is returned to Inngest)
    const outline = await step.run("extract-and-reconcile-outline", async () => {
      console.log(`[Studio Pipeline] Step: Loading units for source ${sourceId}...`);
      const { units, title } = await loadUnitsForSource({
        type,
        url: targetPdfUrl || url,
        filePath,
        originalName,
      });

      if (!units || units.length === 0) {
        console.warn(`[Studio Pipeline] No structural units extracted for source ${sourceId} ("${title}").`);
        return { chapters: [] };
      }

      let tokenBudget = 5000;
      if (type === "youtube" || type === "audio") {
        const totalDurationSec =
          units.length > 0
            ? (units[units.length - 1].rangeEnd - (units[0].rangeStart || 0))
            : 0;

        if (totalDurationSec > 3600) {
          tokenBudget = 6000; // > 1 hour
        } else if (totalDurationSec > 1800) {
          tokenBudget = 4000; // 30 mins to 1 hour
        } else {
          tokenBudget = 2000; // <= 30 mins
        }
        console.log(`[Studio Pipeline] Media duration: ${Math.round(totalDurationSec / 60)} mins -> Selected tokenBudget: ${tokenBudget} tokens`);
      }

      console.log(`[Studio Pipeline] Step: Creating batches from ${units.length} unit(s) with tokenBudget ${tokenBudget}...`);
      const batches = createBatches(units, tokenBudget);


      console.log(`[Studio Pipeline] Step: Extracting segments from ${batches.length} batch(es)...`);
      const segments = await extractBatchSegments(batches, 5);

      console.log(`[Studio Pipeline] Step: Reconciling ${segments.length} segment(s) into chapters...`);
      return await reconcileOutline(segments, title);
    });

    // Step 3: Save outline to MongoDB Workspace source
    await step.run("save-studio-outline", async () => {
      return await saveStudioOutline(workspaceId, userId, sourceId, outline);
    });

    return {
      success: true,
      workspaceId,
      sourceId,
      chapterCount: outline?.chapters?.length || 0,
    };
  }
);
