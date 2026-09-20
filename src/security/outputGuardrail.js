import { runGuardrails, Category } from "@openai/guardrails";
import { openai } from "../lib/openai.lib.js";

/**
 * Official OpenAI Moderation Guardrail Bundle configuration.
 * Checks all supported moderation categories using the official omni-moderation model.
 */
const OUTPUT_MODERATION_BUNDLE = {
  guardrails: [
    {
      name: "Moderation",
      config: {
        categories: Object.values(Category),
      },
    },
  ],
};

const USER_SAFE_OUTPUT_VIOLATION_MESSAGE =
  "Your response could not be delivered because it did not pass the required safety checks.";

const GUARDRAIL_EXECUTION_FAILURE_MESSAGE =
  "Your response could not be delivered because security validation could not be completed. Please try again.";

/**
 * Extracts a deterministic text representation of the user-visible natural language
 * answer from the structured RAG response object (StructuredFinalResponseSchema).
 *
 * Includes:
 * - overallSummary
 * - sectionTitle
 * - section summary
 * - segment content
 *
 * Omits citation metadata (sourceId, sourceUrl, pageNumber, timestamps, etc.).
 *
 * @param {Object|string} answer - Validated structured answer or string.
 * @returns {string} Plain text representation of the answer.
 */
export function extractAnswerText(answer) {
  if (!answer) return "";

  if (typeof answer === "string") {
    return answer.trim();
  }

  const textSegments = [];

  if (typeof answer.overallSummary === "string" && answer.overallSummary.trim()) {
    textSegments.push(answer.overallSummary.trim());
  }

  if (Array.isArray(answer.sections)) {
    for (const section of answer.sections) {
      if (!section || typeof section !== "object") continue;

      if (typeof section.sectionTitle === "string" && section.sectionTitle.trim()) {
        textSegments.push(section.sectionTitle.trim());
      }

      if (typeof section.summary === "string" && section.summary.trim()) {
        textSegments.push(section.summary.trim());
      }

      if (Array.isArray(section.segments)) {
        for (const segment of section.segments) {
          if (!segment || typeof segment !== "object") continue;

          if (typeof segment.content === "string" && segment.content.trim()) {
            textSegments.push(segment.content.trim());
          }
        }
      }
    }
  }

  return textSegments.join("\n\n");
}

/**
 * Inspects the final validated RAG answer through OpenAI Moderation Guardrail
 * before it is returned to the user or persisted to the database.
 *
 * @param {Object|string} answer - The validated RAG structured answer.
 * @param {Object} [options] - Optional overrides for testing (e.g. mock client).
 * @throws {Error} If moderation violation detected (400) or execution fails (500/fail-closed).
 * @returns {Promise<{ passed: boolean }>} Resolves if output is safe.
 */
export async function checkGeneratedOutput(answer, options = {}) {
  const textToModerate = extractAnswerText(answer);

  if (!textToModerate || textToModerate.trim().length === 0) {
    console.error(
      "[OutputGuardrail] ❌ Output moderation failed. Response rejected.",
      "Generated content is empty or invalid"
    );
    const failClosedError = new Error(GUARDRAIL_EXECUTION_FAILURE_MESSAGE);
    failClosedError.statusCode = 500;
    throw failClosedError;
  }

  const client = options.client || openai;

  try {
    const results = await runGuardrails(
      textToModerate,
      OUTPUT_MODERATION_BUNDLE,
      { guardrailLlm: client, client },
      true
    );

    const isFlagged =
      Array.isArray(results) &&
      results.some((r) => r?.tripwireTriggered);

    if (isFlagged) {
      console.warn(
        "[OutputGuardrail] 🛡️ Unsafe generated output detected. Response rejected."
      );

      const error = new Error(USER_SAFE_OUTPUT_VIOLATION_MESSAGE);
      error.statusCode = 400;
      throw error;
    }

    return { passed: true };
  } catch (error) {
    if (error.statusCode === 400) {
      throw error;
    }

    console.error(
      "[OutputGuardrail] ❌ Output moderation failed. Response rejected.",
      error?.message || error
    );

    const failClosedError = new Error(GUARDRAIL_EXECUTION_FAILURE_MESSAGE);
    failClosedError.statusCode = 500;
    throw failClosedError;
  }
}
