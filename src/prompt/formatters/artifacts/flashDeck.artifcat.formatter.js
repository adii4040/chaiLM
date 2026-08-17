/**
 * Formats the prompt and rules for generating a Flashcard Deck from source outline summary.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.outline - summaryOutline object containing chapters
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @param {number} [params.options.cardCount=15]
 * @returns {string} Formatted type-specific prompt content
 */
export function formatFlashDeckPrompt({ sourceTitle, sourceType = "document", outline, workspaceTitle = "Workspace", options = {} }) {
  const chapters = outline?.chapters || [];
  const targetCount = options.cardCount || 15;

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
    `FLASHCARD DECK GENERATION DIRECTIVE:\n` +
    `You are tasked with generating an active-recall Flashcard Deck for "${sourceTitle}" (Workspace: "${workspaceTitle}").\n` +
    `Target Number of Flashcards: approximately ${targetCount} cards.\n\n` +
    `FLASHCARD CREATION RULES:\n` +
    `1. High-Yield Focus: Extract cards strictly from core technical concepts, definitions, architectural trade-offs, principles, internal tool mechanics, and vivid domain analogies.\n` +
    `2. STRICT TECHNICAL YIELD RULE: Do NOT create cards testing soft skills, generic motivation, career advice, or conversational filler (e.g., 'What is a mindset?', 'Importance of learning', 'Struggles in career', 'Confidence evolution'). Focus 100% of cards on concrete engineering & domain knowledge.\n` +
    `3. TECHNICAL ANALOGY MAPPING RULE: If domain analogies are present in the source (e.g., Brahma/Vishnu/Shiva for Event Sourcing), craft the card front and back around the technical computer science mapping (e.g., "How does the triad of Brahma, Vishnu, and Shiva map to Event Sourcing state mutations?") rather than asking generic religious questions.\n` +
    `4. Card Front (Prompt): Craft clear, unambiguous questions or concept prompts. Avoid yes/no questions; use 'What is...', 'How does...', 'Why is...', or 'Compare...'.\n` +
    `5. Card Back (Answer): Provide a concise, accurate, and self-contained explanation on the back.\n` +
    `6. Hint: Include a helpful, subtle memory cue on each card to assist recall without giving away the full answer immediately.\n` +
    `7. Source Reference: Set \`sourceReference\` to the relevant chapter or rangeLabel (e.g. "${chapters[0]?.rangeLabel || "Chapter 1"}").\n` +
    `8. Difficulty: Accurately categorize each card as "easy" (basic definitions/facts), "medium" (mechanics/workflows), or "hard" (trade-offs, architectural edge cases).\n\n` +
    `SOURCE MASTER OUTLINE & SUMMARY DATA:\n` +
    `Document: ${sourceTitle} (Type: ${sourceType})\n\n` +
    `${formattedChapters}`
  );
}