import { StudioArtifact } from "../models/StudioArtifact.js";
import { Workspace } from "../models/Workspace.js";

/**
 * GET /api/studio
 * List all generated artifacts for a workspace.
 */
export async function getStudioArtifacts(req, res) {
  try {
    const { workspaceId, type, sourceId } = req.query;
    const userId = req.user._id;

    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId query parameter is required" });
    }

    const query = { workspaceId, userId };
    if (type) query.type = type;
    if (sourceId) query.sourceId = sourceId;

    const artifacts = await StudioArtifact.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ artifacts });
  } catch (error) {
    console.error("[Studio Controller] getStudioArtifacts error:", error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/studio/:artifactId
 * Get a specific artifact by its artifactId.
 */
export async function getStudioArtifactById(req, res) {
  try {
    const { artifactId } = req.params;
    const userId = req.user._id;

    const artifact = await StudioArtifact.findOne({ artifactId, userId });
    if (!artifact) {
      return res.status(404).json({ error: "Artifact not found" });
    }

    return res.status(200).json({ artifact });
  } catch (error) {
    console.error("[Studio Controller] getStudioArtifactById error:", error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * DELETE /api/studio/:artifactId
 * Delete a specific artifact.
 */
export async function deleteStudioArtifact(req, res) {
  try {
    const { artifactId } = req.params;
    const userId = req.user._id;

    const result = await StudioArtifact.findOneAndDelete({ artifactId, userId });
    if (!result) {
      return res.status(404).json({ error: "Artifact not found" });
    }

    return res.status(200).json({ message: "Artifact deleted successfully", artifactId });
  } catch (error) {
    console.error("[Studio Controller] deleteStudioArtifact error:", error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/studio/outline
 * Ensure master outline exists; triggers on-demand extraction if missing/failed.
 */
export async function ensureStudioOutline(req, res) {
  try {
    const { workspaceId, sourceId } = req.body;
    return res.status(200).json({ message: "ensureStudioOutline endpoint ready", workspaceId, sourceId });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/studio/study-guide
 * Generate or retrieve Study Guide for workspace / source.
 */
export async function generateStudyGuide(req, res) {
  try {
    const { workspaceId, sourceId, title } = req.body;
    return res.status(200).json({ message: "generateStudyGuide endpoint ready", workspaceId, sourceId, title });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/studio/flashcards
 * Generate Flashcards deck from Master Outline.
 */
export async function generateFlashcards(req, res) {
  try {
    const { workspaceId, sourceId, title, cardCount } = req.body;
    return res.status(200).json({ message: "generateFlashcards endpoint ready", workspaceId, sourceId, title, cardCount });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/studio/quiz
 * Generate interactive Quiz from Master Outline.
 */
export async function generateQuiz(req, res) {
  try {
    const { workspaceId, sourceId, title, questionCount, difficulty } = req.body;
    return res.status(200).json({ message: "generateQuiz endpoint ready", workspaceId, sourceId, title, questionCount, difficulty });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/studio/mindmap
 * Generate hierarchical Mind Map tree from Master Outline.
 */
export async function generateMindMap(req, res) {
  try {
    const { workspaceId, sourceId, title } = req.body;
    return res.status(200).json({ message: "generateMindMap endpoint ready", workspaceId, sourceId, title });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/studio/audio-overview
 * Generate 2-host conversational podcast script from Master Outline.
 */
export async function generateAudioOverview(req, res) {
  try {
    const { workspaceId, sourceId, title } = req.body;
    return res.status(200).json({ message: "generateAudioOverview endpoint ready", workspaceId, sourceId, title });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
