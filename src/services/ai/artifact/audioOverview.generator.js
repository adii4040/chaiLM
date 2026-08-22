import { generateStudioArtifact } from "./artifactGenerator.service.js";

/**
 * Generates a 2-host podcast audio overview script from source summary outline.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.summaryOutline
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @returns {Promise<{ episodeTitle: string, summary: string, durationMinutesEstimate: number, dialogue: Array<{ speaker: string, text: string, tone: string }> }>}
 */
export async function generateAudioOverviewArtifact(params) {
  return await generateStudioArtifact({
    ...params,
    type: "audio_overview",
  });
}
