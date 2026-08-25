import { openai } from "../../../lib/openai.lib.js";
import { config } from "../../../config/env.js";
import { zodResponseFormat } from "openai/helpers/zod";
import { buildArtifactPrompt } from "../../../prompt/artifcate_prompt.js";

/**
 * Core AI generation engine for all Studio Artifacts.
 * Uses buildArtifactPrompt to construct grounded prompts and enforces strict Zod schema parsing.
 *
 * @param {Object} params
 * @param {"study_guide" | "flashcards" | "quiz" | "mindmap" | "audio_overview"} params.type - Artifact type
 * @param {string} params.sourceTitle - Title of the source
 * @param {string} [params.sourceType="document"] - Type of source (pdf, youtube, website)
 * @param {Object} params.summaryOutline - The source summary outline containing chapters
 * @param {string} [params.workspaceTitle="Workspace"] - Workspace title
 * @param {Object} [params.options={}] - Custom generation parameters
 * @returns {Promise<Object>} Validated JSON output conforming to the artifact's Zod schema
 */
export async function generateStudioArtifact({
  userPrompt,
  type,
  sourceTitle = "Untitled Source",
  sourceType = "document",
  summaryOutline,
  workspaceTitle = "Workspace",
  options = {},
}) {
  if (!summaryOutline || !Array.isArray(summaryOutline.chapters) || summaryOutline.chapters.length === 0) {
    throw new Error(`Cannot generate artifact "${type}": source summary outline is missing or has no chapters.`);
  }

  const modelName = config.openai.chatModel || "gpt-4o-mini";

  const { systemPrompt, artifactPrompt, schema, schemaName } = buildArtifactPrompt({
    userPrompt,
    type,
    sourceTitle,
    sourceType,
    summaryOutline,
    workspaceTitle,
    options,
  });

  console.log(`[Studio Artifact Generator] Generating "${type}" for "${sourceTitle}" using ${modelName}...`);

  try {
    const completion = await openai.chat.completions.parse({
      model: modelName,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: artifactPrompt },
      ],
      response_format: zodResponseFormat(schema, schemaName),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error(`OpenAI failed to return parsed JSON for artifact "${type}"`);
    }

    console.log(`[Studio Artifact Generator] Successfully generated "${type}" for "${sourceTitle}".`);
    return parsed;
  } catch (error) {
    console.error(`[Studio Artifact Generator Error] Failed to generate "${type}":`, error);
    throw new Error(`Failed to generate ${type}: ${error.message}`);
  }
}
