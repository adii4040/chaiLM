/**
 * Formats the prompt and rules for generating a hierarchical Mind Map from source outline summary.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.outline - summaryOutline object containing chapters
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options]
 * @returns {string} Formatted type-specific prompt content
 */
export function formatMindMapPrompt({ sourceTitle, sourceType = "document", outline, workspaceTitle = "Workspace", options = {} }) {
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
    `MIND MAP GENERATION DIRECTIVE:\n` +
    `You are tasked with structuring a clear, multi-level hierarchical Mind Map tree for "${sourceTitle}" (Workspace: "${workspaceTitle}").\n\n` +
    `MIND MAP HIERARCHY RULES:\n` +
    `1. Central Root Node: The \`rootNode.label\` must represent the core subject/document title.\n` +
    `2. Primary Branches: Create primary branches corresponding to the major sections, themes, or architectural pillars.\n` +
    `3. Sub-Branches: Under each primary branch, define specific sub-topics, components, or mechanisms.\n` +
    `4. Key Details: Under each sub-branch, provide 2 to 4 concise bullet points (\`keyDetails\`) containing concrete facts, definitions, or operational steps.\n` +
    `5. Visual Clarity: Keep node labels concise and scannable for graph/canvas rendering.\n\n` +
    `SOURCE MASTER OUTLINE & SUMMARY DATA:\n` +
    `Document: ${sourceTitle} (Type: ${sourceType})\n\n` +
    `${formattedChapters}`
  );
}