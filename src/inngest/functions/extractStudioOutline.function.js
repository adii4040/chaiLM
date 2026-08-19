import { inngest } from "../client.js";
import { loadUnitsForSource } from "../../services/studioUnitLoader.service.js";
import { createBatches } from "../../utils/batchUnits.utils.js";
import { extractBatchSegments } from "../../services/ai/outlineExtractor.service.js";
import { reconcileOutline } from "../../services/ai/outlineMerge.service.js";
import { updateStudioOutlineStatus, saveStudioOutline } from "../../services/indexer.service.js";

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

    // Step 2: Extract & Reconcile in RAM (Lean step: only the final compact outline ~2KB is returned to Inngest)
    const outline = await step.run("extract-and-reconcile-outline", async () => {
      console.log(`[Studio Pipeline] Step: Loading units for source ${sourceId}...`);
      const { units, title } = await loadUnitsForSource({ type, url, filePath, originalName });

      if (!units || units.length === 0) {
        console.warn(`[Studio Pipeline] No structural units extracted for source ${sourceId} ("${title}").`);
        return { chapters: [] };
      }

      const tokenBudget = (type === "youtube" || type === "audio") ? 2000 : 3500;
      console.log(`[Studio Pipeline] Step: Creating batches from ${units.length} unit(s) with high-density budget ${tokenBudget} tokens...`);
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
