/**
 * Formats the prompt and rules for generating a comprehensive Study Guide from source outline summary.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.outline - summaryOutline object containing chapters
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @returns {string} Formatted type-specific prompt content
 */
export function formatStudyGuidePrompt({ sourceTitle, sourceType = "document", outline, workspaceTitle = "Workspace", options = {} }) {
  const chapters = outline?.chapters || [];

  const formattedChapters = chapters
    .map((chap, idx) => {
      const takeawaysList = (chap.takeaways || []).map((t) => `  - ${t}`).join("\n");
      const termsList = (chap.terms || []).map((t) => `  - ${t.term}: ${t.definition}`).join("\n");

      return `[Section/Chapter ${chap.chapterIndex || idx + 1}: "${chap.chapterTitle}"] (${chap.rangeLabel || "N/A"})\n` +
        `Summary: ${chap.summary}\n` +
        `Key Takeaways:\n${takeawaysList || "  None provided"}\n` +
        `Key Terminology:\n${termsList || "  None provided"}`;
    })
    .join("\n\n");

  return (
    `STUDY GUIDE GENERATION DIRECTIVE:\n` +
    `You are tasked with synthesizing an authoritative, structured, and comprehensive Study Guide for "${sourceTitle}" (Workspace: "${workspaceTitle}").\n\n` +
    `GUIDELINES & RULES:\n` +
    `1. Executive Summary: Write a high-level, clear overview capturing the fundamental thesis, core events/arguments, and takeaways of the material.\n` +
    `2. Key Themes (Full Coverage): Group the material into logical, thematic modules covering EVERY section/chapter in the input outline summary data. Each theme must have a descriptive title, a thorough narrative overview, and bulleted key points.\n` +
    `3. High-Yield Domain Glossary:\n` +
    `   - Include ONLY domain-specific technical terms, specialized vocabulary, algorithms, named entities, key figures, or core concepts.\n` +
    `   - STRICTLY FORBIDDEN: Do NOT include generic conversational words or plain dictionary phrases (e.g. 'mindset', 'practical experience', 'trade-offs', 'pre-enrollment', 'struggle').\n` +
    `   - ANALOGY & METAPHOR RULE: If analogies or metaphors are present, define them strictly in terms of their contextual meaning within the subject matter.\n` +
    `4. Key Takeaways: Provide high-impact summary bullets highlighting the essential conclusions, principles, revelations, or findings.\n` +
    `5. Review Checklist: Create actionable self-assessment questions to test deep comprehension of the subject matter.\n\n` +

    `SOURCE MASTER OUTLINE & SUMMARY DATA:\n` +
    `Document: ${sourceTitle} (Type: ${sourceType})\n\n` +
    `${formattedChapters}`
  );
}