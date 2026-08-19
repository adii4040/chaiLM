/**
 * Formats the prompt and rules for generating an interactive Quiz from source outline summary.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.outline - summaryOutline object containing chapters
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @param {number} [params.options.questionCount=10]
 * @param {string} [params.options.difficulty="medium"]
 * @returns {string} Formatted type-specific prompt content
 */
export function formatQuizPrompt({ sourceTitle, sourceType = "document", outline, workspaceTitle = "Workspace", options = {} }) {
  const chapters = outline?.chapters || [];
  const targetCount = options.questionCount || 10;
  const targetDifficulty = options.difficulty || "medium";

  const formattedChapters = chapters
    .map((chap, idx) => {
      const takeawaysList = (chap.takeaways || []).map((t) => `  - ${t}`).join("\n");
      const termsList = (chap.terms || []).map((t) => `  - ${t.term}: ${t.definition}`).join("\n");

      return `[Section ${chap.chapterIndex || idx + 1}: "${chap.chapterTitle}"] (${chap.rangeLabel || "N/A"})\n` +
        `Summary: ${chap.summary}\n` +
        `Key Takeaways:\n${takeawaysList || "  None provided"}\n` +
        `Key Terminology:\n${termsList || "  None provided"}`;
    })
    .join("\n\n");

  return (
    `QUIZ GENERATION DIRECTIVE:\n` +
    `You are tasked with generating an interactive, rigorous assessment Quiz for "${sourceTitle}" (Workspace: "${workspaceTitle}").\n` +
    `Target Number of Questions: ${targetCount}\n` +
    `Target Difficulty Level: ${targetDifficulty}\n\n` +
    `QUIZ QUESTION RULES:\n` +
    `1. Full Outline Coverage: Distribute questions across ALL document sections/chapters so all major topics and events are assessed.\n` +
    `2. STRICT FACTUAL RIGOR RULE:\n` +
    `   - FORBIDDEN: Do NOT create trivial quote-recall questions, generic soft-skill questions, or obvious filler choices (e.g. 'What is a mindset?', 'Importance of learning', 'Why should one work hard?').\n` +
    `   - REQUIRED: Focus 100% of questions on concrete mechanisms, core facts, specific character/entity actions, causality, algorithm/domain trade-offs, and principles.\n` +
    `3. ANALOGY & METAPHOR QUESTION RULE:\n` +
    `   - If domain analogies or metaphors are used in the source, format the question to assess the core subject matter mapping rather than asking superficial trivia.\n` +
    `4. Question Format: Provide 3 to 4 distinct, plausible answer choices in the \`options\` array for each question.\n` +
    `5. Zero-based Answer Index: \`correctAnswerIndex\` MUST be the 0-based numerical index (0, 1, 2, or 3) corresponding to the correct answer choice in the \`options\` array.\n` +
    `6. In-Depth Explanation: Every question MUST include an \`explanation\` field detailing why the correct choice is accurate and why the alternative distractors are incorrect.\n` +
    `7. Plausible Domain Distractors: Avoid silly or obvious wrong choices. Distractors should reflect believable misconceptions or related domain terms.\n` +
    `8. Source Reference: Set \`sourceReference\` to the relevant section or rangeLabel (e.g. "${chapters[0]?.rangeLabel || "Chapter 1"}").\n\n` +

    `SOURCE MASTER OUTLINE & SUMMARY DATA:\n` +
    `Document: ${sourceTitle} (Type: ${sourceType})\n\n` +
    `${formattedChapters}`
  );
}