import { generateStudioArtifact } from "./artifactGenerator.service.js";

/**
 * Generates a hierarchical Mind Map tree artifact from source summary outline.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.summaryOutline
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @returns {Promise<{ mapTitle: string, rootNode: { label: string, branches: Array } }>}
 */
export async function generateMindMapArtifact(params) {
  return await generateStudioArtifact({
    ...params,
    type: "mindmap",
  });
}
