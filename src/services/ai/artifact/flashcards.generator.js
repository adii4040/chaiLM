import { generateStudioArtifact } from "./artifactGenerator.service.js";

/**
 * Generates an active-recall Flashcard Deck artifact from source summary outline.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.summaryOutline
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @param {number} [params.options.cardCount=15]
 * @returns {Promise<{ deckTitle: string, cards: Array<{ id: number, front: string, back: string, hint: string, sourceReference: string, difficulty: string }> }>}
 */
export async function generateFlashcardsArtifact(params) {
  return await generateStudioArtifact({
    ...params,
    type: "flashcards",
  });
}
