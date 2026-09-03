/**
 * Formats the prompt and rules for generating a 2-host podcast audio overview script from source outline summary.
 *
 * @param {Object} params
 * @param {string} params.sourceTitle
 * @param {string} [params.sourceType]
 * @param {Object} params.outline - summaryOutline object containing chapters
 * @param {string} [params.workspaceTitle]
 * @param {Object} [params.options] - Options including fixed length (3 or 5), mood, and podcastType
 * @returns {string} Formatted type-specific prompt content
 */
export function formatAudioOverviewPrompt({ sourceTitle, sourceType = "document", outline, workspaceTitle = "Workspace", options = {} }) {
  const chapters = outline?.chapters || [];

  // Parse integer duration length from payload (3 or 5, defaults to 5)
  const targetMinutes = Number(options.length) === 3 ? 3 : 5;

  // Extract user-specified mood and podcast format/type
  const chosenMood = options.mood ? String(options.mood).trim() : (options.vibe ? String(options.vibe).trim() : "engaging, lively, and intellectually curious");
  const chosenType = (options.podcastType || options.type) ? String(options.podcastType || options.type).trim() : "conversational deep-dive";

  const lengthSettings = targetMinutes === 3
    ? {
        label: "3 Minutes (Focused Discussion)",
        durationMinutes: 3,
        minTurns: 16,
        maxTurns: 20,
        wordCount: "480 to 550 words",
        minSentencesPerTurn: "2 to 4 full sentences (at least 30 words per turn)",
        styleGuidance:
          "High-density, substantive discussion. Dive straight into the core insights, technical mechanisms, and practical significance. Explain the concepts clearly with depth and impact.",
      }
    : {
        label: "5 Minutes (Extended Discussion)",
        durationMinutes: 5,
        minTurns: 26,
        maxTurns: 32,
        wordCount: "800 to 950 words",
        minSentencesPerTurn: "3 to 5 full sentences (at least 35 to 45 words per turn)",
        styleGuidance:
          "Comprehensive conversational deep dive. Give each chapter room to breathe with rich back-and-forth dialogue, intuitive real-world analogies, and exploring technical mechanics and trade-offs.",
      };

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
    `You are tasked with writing a 2-host podcast dialogue script discussing "${sourceTitle}" (Workspace: "${workspaceTitle}").\n\n` +
    `================================================================================\n` +
    `PRIORITY #1 DIRECTIVE: PODCAST MOOD, FORMAT & ATMOSPHERE (STRICT REQUIREMENT)\n` +
    `================================================================================\n` +
    `The user has explicitly mandated the format and emotional atmosphere for this episode:\n` +
    `- MANDATED PODCAST FORMAT / TYPE: "${chosenType}"\n` +
    `- MANDATED MOOD & VOCAL ATMOSPHERE: "${chosenMood}"\n\n` +
    `YOU MUST PRIORITIZE THIS DIRECTIVE ABOVE ALL OTHER STYLISTIC CHOICES:\n` +
    `1. Voice & Personality: Shape both hosts' language, vocabulary, banter, humor, and rapport to authentically reflect "${chosenMood}".\n` +
    `2. Structural Format: Structure the conversation strictly as a "${chosenType}". (E.g. If 'debate', hosts must argue opposing viewpoints and challenge assumptions; if 'humorous', include sharp wit and comedic analogies; if 'storytelling', build dramatic narrative tension; if 'casual', speak like friends over coffee).\n` +
    `3. TTS Instructions: Tailor the 'tone' and 'ai_instruction' property on EVERY turn to guide the text-to-speech voice to perform with the exact cadence, pauses, energy, and inflection demanded by "${chosenMood}".\n` +
    `4. Output Fields: Populate the JSON fields "podcastType" with "${chosenType}" and "mood" with "${chosenMood}".\n` +
    `================================================================================\n\n` +
    `TARGET EPISODE LENGTH & DURATION DIRECTIVE (CRITICAL FOR AUDIO TIMING):\n` +
    `- Target Spoken Length: Exactly ${lengthSettings.label}\n` +
    `- Total Word Count: You MUST generate at least ${lengthSettings.wordCount} across the entire script.\n` +
    `- Dialogue Turn Count: You MUST produce between ${lengthSettings.minTurns} and ${lengthSettings.maxTurns} turns in the \`dialogue\` array. Do NOT stop early.\n` +
    `- Turn Substantiveness: Each host turn MUST be ${lengthSettings.minSentencesPerTurn}. NEVER output short 1-line quips, brief acknowledgments like "I agree!", or empty questions alone. Every single turn must contain a substantive, thoughtful explanation, analogy, or counter-perspective.\n` +
    `- Estimated Duration Field: Set \`durationMinutesEstimate\` to ${lengthSettings.durationMinutes}.\n` +
    `- Pacing Style: ${lengthSettings.styleGuidance}\n\n` +
    `PODCAST CONVERSATION RULES:\n` +
    `1. Two Distinct Hosts:\n` +
    `   - "Host 1": Curious, framing big questions, setting up topics, using vivid everyday analogies.\n` +
    `   - "Host 2": Analytical expert, breaking down the technical mechanics, trade-offs, and nuances.\n` +
    `2. Conversational Substance: Never output superficial back-and-forth. Both hosts must continually add new value, counterpoints, or fresh analogies to the discussion.\n` +
    `3. Concept Explanations: Never just read bullet points. Explain *why* things matter using intuitive breakdowns and real-world implications, filtered through the lens of "${chosenMood}".\n` +
    `4. Tone Direction: Set the \`tone\` property for each dialogue turn.\n` +
    `5. TTS Delivery Instruction: For each turn, write an \`ai_instruction\` — a natural-language delivery guide for speech synthesis describing pacing, emphasis, and emotional coloring.\n` +
    `6. Structure: Opening hook -> Thematic deep dives across chapters -> Practical conclusions / sign-off.\n\n` +
    `SOURCE MASTER OUTLINE & SUMMARY DATA:\n` +
    `Document: ${sourceTitle} (Type: ${sourceType})\n\n` +
    `${formattedChapters}`
  );
}