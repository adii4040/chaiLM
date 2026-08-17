import { StudioArtifact } from "../models/StudioArtifact.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { inngest } from "../inngest/client.js";
import { updateStudioOutlineStatus } from "../services/indexer.service.js";

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
    return res.status(200).json({
      success: true,
      count: artifacts.length,
      artifacts,
    });
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

    return res.status(200).json({ success: true, artifact });
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

    return res.status(200).json({
      success: true,
      message: "Artifact deleted successfully",
      artifactId,
    });
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
    const userId = req.user._id;

    if (!workspaceId || !sourceId) {
      return res.status(400).json({ error: "workspaceId and sourceId are required" });
    }

    const workspace = await Workspace.findOne({ workspaceId, userId });
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const source = workspace.sources.find(
      (s) => s.sourceId === sourceId || s._id?.toString() === sourceId
    );
    if (!source) {
      return res.status(404).json({ error: "Source not found in workspace" });
    }

    const status = source.studioOutlineStatus || "NOT_STARTED";

    if (status === "COMPLETED" && source.summaryOutline?.chapters?.length > 0) {
      return res.status(200).json({
        status: "COMPLETED",
        sourceId: source.sourceId,
        title: source.title,
        chapterCount: source.summaryOutline.chapters.length,
        outline: source.summaryOutline,
      });
    }

    if (status === "PROCESSING") {
      return res.status(202).json({
        status: "PROCESSING",
        message: "Studio outline extraction is currently in progress",
        sourceId: source.sourceId,
      });
    }

    // Trigger on-demand outline extraction for NOT_STARTED or FAILED
    console.log(
      `[Studio Controller] Triggering on-demand outline extraction for source ${source.sourceId} ("${source.title}")...`
    );
    await updateStudioOutlineStatus(workspaceId, userId, source.sourceId, "PROCESSING");

    await inngest.send({
      name: "studio/outline.requested",
      data: {
        workspaceId,
        userId: userId.toString(),
        sourceId: source.sourceId,
        type: source.sourceType,
        url: source.sourceUrl,
        filePath: source.sourceUrl,
        originalName: source.title,
      },
    });

    return res.status(202).json({
      status: "PROCESSING",
      message: "Studio outline extraction started on-demand",
      sourceId: source.sourceId,
    });
  } catch (error) {
    console.error("[Studio Controller] ensureStudioOutline error:", error);
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
