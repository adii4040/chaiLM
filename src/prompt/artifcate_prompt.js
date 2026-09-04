import {
  formatStudyGuidePrompt,
  formatFlashDeckPrompt,
  formatQuizPrompt,
  formatMindMapPrompt,
  formatAudioOverviewPrompt,
} from "./formatters/artifacts/index.js";

import {
  StudyGuideSchema,
  FlashcardDeckSchema,
  QuizSchema,
  MindMapSchema,
  AudioOverviewSchema,
} from "../utils/responseSchema.utils.js";

/**
 * Base system prompt shared across all studio artifact generation.
 */
const BASE_ARTIFACT_SYSTEM_PROMPT =
  "You are an expert pedagogical architect, principal curriculum designer, and domain master across all fields of computer science, engineering, business, and literature.\n" +
  "Your mission is to transform structured source outlines and summaries into world-class, rigorous, engaging learning artifacts.\n\n" +
  "UNIVERSAL GROUNDING & ACCURACY INVARIANTS:\n" +
  "1. Strict Grounding: Base all generated content exclusively on the facts, concepts, definitions, and analogies provided in the source outline and summary data. Do not hallucinate outside facts.\n" +
  "2. Technical Precision: Maintain exact domain terminology, formal definitions, protocol names, and architectural mechanics.\n" +
  "3. High Density: Avoid fluff or generic filler phrases. Maximize conceptual clarity and learning value.\n" +
  "4. Output Validity: You must adhere strictly to the requested structured JSON schema.";

/**
 * Registry mapping artifact types to their respective schema and formatter.
 */
export const ARTIFACT_REGISTRY = {
  study_guide: {
    name: "study_guide",
    schema: StudyGuideSchema,
    formatter: formatStudyGuidePrompt,
    schemaName: "study_guide_artifact",
  },
  flashcards: {
    name: "flashcards",
    schema: FlashcardDeckSchema,
    formatter: formatFlashDeckPrompt,
    schemaName: "flashcards_artifact",
  },
  quiz: {
    name: "quiz",
    schema: QuizSchema,
    formatter: formatQuizPrompt,
    schemaName: "quiz_artifact",
  },
  mindmap: {
    name: "mindmap",
    schema: MindMapSchema,
    formatter: formatMindMapPrompt,
    schemaName: "mindmap_artifact",
  },
  audio_overview: {
    name: "audio_overview",
    schema: AudioOverviewSchema,
    formatter: formatAudioOverviewPrompt,
    schemaName: "audio_overview_artifact",
  },
};

/**
 * Builds the complete prompt package for an artifact generation LLM call.
 *
 * @param {Object} params
 * @param {"study_guide" | "flashcards" | "quiz" | "mindmap" | "audio_overview"} params.type - Artifact type
 * @param {string} params.sourceTitle - Title of the source document/media
 * @param {string} [params.sourceType="document"] - Type of source (pdf, youtube, website)
 * @param {Object} params.summaryOutline - The source summary outline containing chapters
 * @param {string} [params.workspaceTitle="Workspace"] - Workspace title
 * @param {Object} [params.options={}] - Custom options (e.g. cardCount, questionCount, difficulty)
 * @returns {{ systemPrompt: string, userPrompt: string, schema: Object, schemaName: string }}
 */
export function buildArtifactPrompt({
  userPrompt,
  type,
  sourceTitle = "Untitled Source",
  sourceType = "document",
  summaryOutline,
  workspaceTitle = "Workspace",
  options = {},
}) {
  const config = ARTIFACT_REGISTRY[type];

  if (!config) {
    throw new Error(`Unsupported artifact type "${type}". Supported types: ${Object.keys(ARTIFACT_REGISTRY).join(", ")}`);
  }

  const typeSpecificPrompt = config.formatter({
    userPrompt,
    sourceTitle,
    sourceType,
    outline: summaryOutline,
    workspaceTitle,
    options,
  });

  const systemPrompt = `${BASE_ARTIFACT_SYSTEM_PROMPT}\n\nARTIFACT ROLE SPECIFICATION:\nYou are generating the artifact "${type}" following the exact schema provided.`;
  const artifactPrompt = typeSpecificPrompt;

  return {
    systemPrompt,
    artifactPrompt,
    schema: config.schema,
    schemaName: config.schemaName,
  };
}
