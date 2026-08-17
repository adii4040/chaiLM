import { generateStudioArtifact } from "./artifactGenerator.service.js";

/**
 * Generates an executive Study Guide artifact from source summary outline.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.summaryOutline
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @returns {Promise<{ title: string, executiveSummary: string, keyThemes: Array, glossary: Array, keyTakeaways: Array, reviewChecklist: Array }>}
 */
export async function generateStudyGuideArtifact(params) {
  return await generateStudioArtifact({
    ...params,
    type: "study_guide",
  });
}
