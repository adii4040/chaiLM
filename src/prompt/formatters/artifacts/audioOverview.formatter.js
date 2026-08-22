/**
 * Formats the prompt and rules for generating a 2-host podcast audio overview script from source outline summary.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.outline - summaryOutline object containing chapters
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @returns {string} Formatted type-specific prompt content
 */
export function formatAudioOverviewPrompt({ sourceTitle, sourceType = "document", outline, workspaceTitle = "Workspace", options = {} }) {
  const chapters = outline?.chapters || [];

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
    `AUDIO OVERVIEW (PODCAST SCRIPT) DIRECTIVE:\n` +
    `You are tasked with writing an engaging, deep-dive 2-host podcast dialogue script discussing "${sourceTitle}" (Workspace: "${workspaceTitle}").\n\n` +
    `PODCAST CONVERSATION RULES:\n` +
    `1. Two Distinct Hosts:\n` +
    `   - "Host 1": Curious, framing big questions, setting up topics, using vivid everyday analogies.\n` +
    `   - "Host 2": Analytical expert, breaking down the technical mechanics, trade-offs, and nuances.\n` +
    `2. Natural Conversational Flow: Include genuine back-and-forth banter, reactions ("Exactly", "That's a great point", "Wait, why is that?"), and smooth transitions between sections.\n` +
    `3. Concept Explanations: Never just read bullet points. Explain *why* things matter using analogies, intuitive breakdowns, and real-world implications.\n` +
    `4. Tone Direction: Set the \`tone\` property for each dialogue turn (e.g. "enthusiastic", "curious", "analytical", "humorous", "reflective").\n` +
    `5. Structure: Opening hook -> Thematic deep dives -> Practical conclusions / sign-off.\n\n` +
    `SOURCE MASTER OUTLINE & SUMMARY DATA:\n` +
    `Document: ${sourceTitle} (Type: ${sourceType})\n\n` +
    `${formattedChapters}`
  );
}