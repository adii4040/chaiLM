// server/src/security/contextGuardrail.js

/**
 * Unicode normalization and invisible character stripping.
 * Returns a normalized, lowercase string for deterministic pattern analysis
 * while preserving the original chunk content completely untouched.
 */
export function normalizeText(text) {
  if (typeof text !== "string") return "";

  return (
    text
      // 1. Unicode NFKC Canonical Normalization
      .normalize("NFKC")
      // 2. Strip invisible, zero-width, and directional control characters
      .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E\u202A-\u202E\u2066-\u2069]/g, "")
      // 3. Consolidate consecutive whitespace, tabs, and line breaks
      .replace(/\s+/g, " ")
      // 4. Lowercase for case-insensitive matching
      .toLowerCase()
      .trim()
  );
}

/**
 * Detection Signal Definitions for Indirect Prompt Injection.
 * Designed to detect instruction-data boundary violations, precedence overrides,
 * role impersonation, exfiltration, and concealment directives.
 */
const SIGNAL_DEFINITIONS = [
  {
    category: "PRECEDENCE_OVERRIDE",
    weight: 3.5,
    patterns: [
      /when this document is retrieved/i,
      /treat this (document|content|text|context|data) as (the )?(highest|high|top|primary|supreme) priority/i,
      /ignore (all )?(previous|prior|above|former|preceding) (instructions|directions|rules|prompts|guidelines|commands)/i,
      /disregard (all )?(previous|prior|above|former) (instructions|rules|prompts|commands)/i,
      /override (all )?(system|internal|assistant|developer) (instructions|rules|prompts|guidelines)/i,
      /forget (all )?(previous|prior|above) (instructions|rules|prompts)/i,
      /these instructions (supersede|override|take precedence over) (all|any) (others|other rules|system instructions)/i,
    ],
  },
  {
    category: "EXFILTRATION_DIRECTIVE",
    weight: 3.5,
    patterns: [
      /(include|print|output|reveal|display|leak|echo|dump|repeat|provide|share|state) (the |your |all )?(system prompt|internal (instructions|rules|config|configuration)|prompt rules|initial instructions|developer message|hidden prompt|api keys?|credentials?|secrets?)/i,
      /(system prompt|internal (instructions|rules|config)|prompt rules) in (the |your )?(response|answer|output) before (providing|giving|answering)/i,
      /before answering (the user|the question|the prompt), (output|include|state|repeat|print)/i,
      /repeat (the |your )?(instructions|rules|prompt) above/i,
      /what (are|were) your (original|initial|system) instructions/i,
    ],
  },
  {
    category: "ROLE_IMPERSONATION",
    weight: 2.5,
    patterns: [
      /\[\s*(system|developer|admin|root|instruction)\s*\]/i,
      /<\s*(system|developer|instruction|context_override)\s*>/i,
      /you are now (in|operating in|acting as|switching to) (developer|unrestricted|maintenance|debug|dan|jailbreak|god) mode/i,
      /new (system|operational|developer) (instructions|rules|directives):/i,
      /from now on, you (must|will) (act as|respond as|behave as)/i,
    ],
  },
  {
    category: "CONCEALMENT_DIRECTIVE",
    weight: 2.0,
    patterns: [
      /do not (mention|reveal|tell|disclose|show|let the user know) (about )?(this|these) (instruction|rule|directive|override|modification)/i,
      /keep (this|these) (instruction|rule|directive|override) (secret|hidden|confidential)/i,
      /secretly (include|insert|execute|append|prepend)/i,
      /without mentioning (this|these) (instruction|rule|command)/i,
    ],
  },
  {
    category: "IMPERATIVE_COMMAND_TARGETING_ASSISTANT",
    weight: 1.5,
    patterns: [
      /(assistant|ai|model|system|llm) (must|should|shall|is commanded to) (always|immediately|first)/i,
      /your new task is to/i,
      /you are strictly forbidden from (answering|following system rules)/i,
    ],
  },
];

/**
 * Distinguishes descriptive security discussions from prescriptive injection commands.
 * Lowers score if text is purely educational / journalistic (e.g. discussing prompt injection).
 */
const DESCRIPTIVE_PATTERNS = [
  /prompt injection is (a|an|the|defined as)/i,
  /(attackers?|hackers?|adversar(y|ies)) (attempt|try|use|exploit)/i,
  /vulnerability (in|of|analysis|report|scan)/i,
  /mitigation (strategies|techniques|for)/i,
  /examples of (prompt injection|attacks)/i,
  /for example, an attacker might (say|write|inject)/i,
];

/**
 * Evaluates a single chunk's text for indirect prompt injection risk.
 */
function evaluateChunk(chunkText) {
  const normalized = normalizeText(chunkText);
  if (!normalized) {
    return { score: 0, matchedCategories: [], isFlagged: false };
  }

  let score = 0;
  const matchedCategories = [];

  for (const signal of SIGNAL_DEFINITIONS) {
    let categoryMatched = false;
    for (const pattern of signal.patterns) {
      if (pattern.test(normalized)) {
        score += signal.weight;
        categoryMatched = true;
        break; // Count each category once
      }
    }
    if (categoryMatched) {
      matchedCategories.push(signal.category);
    }
  }

  // Check if text is descriptive security documentation
  const isDescriptive = DESCRIPTIVE_PATTERNS.some((p) => p.test(normalized));
  if (isDescriptive && score > 0) {
    // Dampen isolated mentions in legitimate security documentation
    score = Math.max(0, score - 2.0);
  }

  // High Risk Threshold: Requires either a strong combined signal (e.g. Precedence + Exfiltration >= 3.5)
  // or at least 2 distinct signal categories.
  const isFlagged = score >= 3.5 || matchedCategories.length >= 2;

  return {
    score,
    matchedCategories,
    isFlagged,
  };
}

/**
 * Scans retrieved/reranked context chunks before they reach the prompt builder & LLM.
 *
 * @param {Array<Object>} chunks - Array of candidate chunks from RRF / Reranker.
 * @param {Object} [options] - Optional configuration overrides.
 * @returns {Object} { safeChunks, flaggedChunks, summary }
 */
export function scanRetrievedContext(chunks = [], options = {}) {
  // Fail-closed defensive check
  if (!Array.isArray(chunks)) {
    console.warn("[ContextGuardrail] Input chunks is not an array. Failing closed with empty safeChunks.");
    return {
      safeChunks: [],
      flaggedChunks: [],
      summary: { totalEvaluated: 0, totalSafe: 0, totalFlagged: 0 },
    };
  }

  const safeChunks = [];
  const flaggedChunks = [];

  try {
    chunks.forEach((chunk, index) => {
      const textToInspect = chunk?.pageContent || chunk?.text || "";
      const evaluation = evaluateChunk(textToInspect);

      if (evaluation.isFlagged) {
        const sourceId = chunk?.sourceId || chunk?.metadata?.sourceId || chunk?.document?.metadata?.sourceId || "unknown-source";
        const title = chunk?.title || chunk?.metadata?.title || chunk?.document?.metadata?.title || "Untitled Document";
        const sourceType = chunk?.sourceType || chunk?.metadata?.sourceType || "document";

        flaggedChunks.push({
          chunkIndex: index,
          sourceId,
          title,
          sourceType,
          score: evaluation.score,
          matchedCategories: evaluation.matchedCategories,
          chunkRef: chunk,
        });

        // Security logging: Log event metadata without leaking full document text
        console.warn(
          `[ContextGuardrail] 🛡️ Quarantined suspicious chunk [index: ${index}, sourceId: ${sourceId}, title: "${title}"] - Risk Score: ${evaluation.score}, Signals: [${evaluation.matchedCategories.join(", ")}]`
        );
      } else {
        // Safe chunk: Preserved completely with original pageContent & metadata
        safeChunks.push(chunk);
      }
    });

    return {
      safeChunks,
      flaggedChunks,
      summary: {
        totalEvaluated: chunks.length,
        totalSafe: safeChunks.length,
        totalFlagged: flaggedChunks.length,
      },
    };
  } catch (error) {
    // Fail-closed behavior: If guardrail fails unexpectedly, do not pass uninspected chunks
    console.error("[ContextGuardrail] Unexpected error during context scanning. Failing closed:", error);
    return {
      safeChunks: [],
      flaggedChunks: chunks.map((c, i) => ({
        chunkIndex: i,
        sourceId: c?.sourceId || "unknown",
        title: c?.title || "unknown",
        score: 99,
        matchedCategories: ["GUARDRAIL_EXECUTION_ERROR"],
        chunkRef: c,
      })),
      summary: {
        totalEvaluated: chunks.length,
        totalSafe: 0,
        totalFlagged: chunks.length,
      },
    };
  }
}
