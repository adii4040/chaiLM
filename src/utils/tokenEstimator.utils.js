/**
 * Fast token estimation heuristic.
 * 1 token is roughly 4 characters in English text.
 * @param {string} text
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}
