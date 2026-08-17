import { generateStudioArtifact } from "./artifactGenerator.service.js";

/**
 * Generates an interactive Quiz artifact from source summary outline.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.summaryOutline
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @param {number} [params.options.questionCount=10]
 * @param {string} [params.options.difficulty="medium"]
 * @returns {Promise<{ quizTitle: string, questions: Array<{ id: number, question: string, options: string[], correctAnswerIndex: number, explanation: string, sourceReference: string }> }>}
 */
export async function generateQuizArtifact(params) {
  return await generateStudioArtifact({
    ...params,
    type: "quiz",
  });
}
