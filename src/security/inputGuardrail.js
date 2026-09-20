import { runGuardrails } from "@openai/guardrails";
import { openai } from "../lib/openai.lib.js";

/**
 * Official OpenAI Jailbreak Guardrail Bundle configuration.
 * Model: "gpt-4.1-mini"
 * Confidence Threshold: 0.7
 * Include Reasoning: false (minimizes token cost and latency)
 * Max Turns: 1 (single-turn user query evaluation)
 */
const JAILBREAK_BUNDLE = {
  guardrails: [
    {
      name: "Jailbreak",
      config: {
        model: "gpt-4.1-mini",
        confidence_threshold: 0.7,
        include_reasoning: false,
        max_turns: 1,
      },
    },
  ],
};

const USER_SAFE_ERROR_MESSAGE =
  "Your request could not be processed because it contains instructions that conflict with the assistant's operating rules.";

const GUARDRAIL_FAILURE_MESSAGE =
  "Your request could not be processed because security validation could not be completed. Please try again.";

/**
 * Inspects the original user query for jailbreak/adversarial manipulation
 * BEFORE it reaches query translation, HyDE, vector embeddings, or synthesis.
 *
 * @param {string} query - The raw user query text.
 * @throws {Error} If a jailbreak is detected (400) or if the guardrail fails to execute (500/fail-closed).
 * @returns {Promise<{ passed: boolean }>} Resolves if query is safe.
 */
export async function checkUserInput(query) {
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    const error = new Error("Query text is required for validation.");
    error.statusCode = 400;
    throw error;
  }

  const trimmedQuery = query.trim();

  try {
    const results = await runGuardrails(
      trimmedQuery,
      JAILBREAK_BUNDLE,
      { guardrailLlm: openai, client: openai },
      true
    );

    const isJailbreak =
      Array.isArray(results) &&
      results.some((r) => r?.tripwireTriggered);

    if (isJailbreak) {
      console.warn("[InputGuardrail] 🛡️ Jailbreak detected. Query rejected.");
      const error = new Error(USER_SAFE_ERROR_MESSAGE);
      error.statusCode = 400;
      throw error;
    }

    return { passed: true };
  } catch (error) {
    if (error.statusCode === 400) {
      throw error;
    }
    console.error(
      "[InputGuardrail] ❌ Jailbreak guardrail execution failed. Request rejected.",
      error?.message || error
    );

    const failClosedError = new Error(GUARDRAIL_FAILURE_MESSAGE);
    failClosedError.statusCode = 500;
    throw failClosedError;
  }
}
