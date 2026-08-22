import { StudioArtifact } from "../models/StudioArtifact.model.js";
import { Workspace } from "../models/Workspace.model.js";
import { inngest } from "../inngest/client.js";
import { updateStudioOutlineStatus } from "../services/indexer.service.js";
import {
  generateStudyGuideArtifact,
  generateFlashcardsArtifact,
  generateQuizArtifact,
  generateMindMapArtifact,
  generateAudioOverviewArtifact,
} from "../services/ai/index.js";

/**
 * GET /api/studio
 * List all generated artifacts for a workspace.
 */
export async function getStudioArtifacts(req, res) {
  try {
    const { workspaceId, type, sourceId } = req.query;
    const userId = req.user?._id;

    if (!workspaceId) {
      return res.status(400).json({ error: "workspaceId query parameter is required" });
    }

    const query = { workspaceId };
    if (userId) query.userId = userId;
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
    const userId = req.user?._id;

    const query = { artifactId };
    if (userId) query.userId = userId;

    const artifact = await StudioArtifact.findOne(query);
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
    const userId = req.user?._id;

    const query = { artifactId };
    if (userId) query.userId = userId;

    const result = await StudioArtifact.findOneAndDelete(query);
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
    const userId = req.user?._id;

    if (!workspaceId || !sourceId) {
      return res.status(400).json({ error: "workspaceId and sourceId are required" });
    }

    const query = { workspaceId };
    if (userId) query.userId = userId;

    const workspace = await Workspace.findOne(query);
    if (!workspace) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const effectiveUserId = userId || workspace.userId;

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
    await updateStudioOutlineStatus(workspaceId, effectiveUserId, source.sourceId, "PROCESSING");

    await inngest.send({
      name: "studio/outline.requested",
      data: {
        workspaceId,
        userId: effectiveUserId.toString(),
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
 * Helper to resolve workspace and verified source with completed outline
 */
async function resolveWorkspaceAndSource(workspaceId, sourceId, userId) {
  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }
  const query = { workspaceId };
  if (userId) query.userId = userId;

  const workspace = await Workspace.findOne(query);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  let source = null;
  if (sourceId) {
    source = workspace.sources.find((s) => s.sourceId === sourceId || s._id?.toString() === sourceId);
    if (!source) {
      throw new Error("Source not found in workspace");
    }
  } else {
    // Default to the first source with completed outline
    source = workspace.sources.find(
      (s) => s.studioOutlineStatus === "COMPLETED" && s.summaryOutline?.chapters?.length > 0
    );
  }

  if (!source || source.studioOutlineStatus !== "COMPLETED" || !source.summaryOutline?.chapters?.length) {
    throw new Error("Source master outline is not ready. Please ensure the studio outline is extracted first.");
  }

  return { workspace, source, effectiveUserId: userId || workspace.userId };
}


/**
 * POST /api/studio/study-guide
 * Generate and save Study Guide artifact.
 */
export async function generateStudyGuide(req, res) {
  try {
    const { workspaceId, sourceId, title, options } = req.body;
    const userId = req.user?._id;

    const { workspace, source, effectiveUserId } = await resolveWorkspaceAndSource(workspaceId, sourceId, userId);

    const studyGuideData = await generateStudyGuideArtifact({
      sourceTitle: source.title,
      sourceType: source.sourceType,
      summaryOutline: source.summaryOutline,
      workspaceTitle: workspace.title,
      options: options || {},
    });

    const artifact = await StudioArtifact.create({
      workspaceId,
      userId: effectiveUserId,
      sourceId: source.sourceId,
      type: "study_guide",
      title: title || studyGuideData.title || `${source.title} Study Guide`,
      data: studyGuideData,
      metadata: {
        sourceTitle: source.title,
        sourceType: source.sourceType,
        chapterCount: source.summaryOutline.chapters.length,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Study guide generated successfully",
      artifact,
    });
  } catch (error) {
    console.error("[Studio Controller] generateStudyGuide error:", error);
    return res.status(400).json({ error: error.message });
  }
}

/**
 * POST /api/studio/flashcards
 * Generate and save Flashcards deck artifact.
 */
export async function generateFlashcards(req, res) {
  try {
    const { workspaceId, sourceId, title, cardCount, options } = req.body;
    const userId = req.user?._id;

    const { workspace, source, effectiveUserId } = await resolveWorkspaceAndSource(workspaceId, sourceId, userId);

    const cardOptions = {
      ...(options || {}),
      cardCount: cardCount || options?.cardCount || 15,
    };

    const flashcardData = await generateFlashcardsArtifact({
      sourceTitle: source.title,
      sourceType: source.sourceType,
      summaryOutline: source.summaryOutline,
      workspaceTitle: workspace.title,
      options: cardOptions,
    });

    const artifact = await StudioArtifact.create({
      workspaceId,
      userId: effectiveUserId,
      sourceId: source.sourceId,
      type: "flashcards",
      title: title || flashcardData.deckTitle || `${source.title} Flashcards`,
      data: flashcardData,
      metadata: {
        sourceTitle: source.title,
        sourceType: source.sourceType,
        totalCards: flashcardData.cards?.length || 0,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Flashcards generated successfully",
      artifact,
    });
  } catch (error) {
    console.error("[Studio Controller] generateFlashcards error:", error);
    return res.status(400).json({ error: error.message });
  }
}

/**
 * POST /api/studio/quiz
 * Generate and save interactive Quiz artifact.
 */
export async function generateQuiz(req, res) {
  try {
    const { workspaceId, sourceId, title, questionCount, difficulty, options } = req.body;
    const userId = req.user?._id;

    const { workspace, source, effectiveUserId } = await resolveWorkspaceAndSource(workspaceId, sourceId, userId);

    const quizOptions = {
      ...(options || {}),
      questionCount: questionCount || options?.questionCount || 10,
      difficulty: difficulty || options?.difficulty || "medium",
    };

    const quizData = await generateQuizArtifact({
      sourceTitle: source.title,
      sourceType: source.sourceType,
      summaryOutline: source.summaryOutline,
      workspaceTitle: workspace.title,
      options: quizOptions,
    });

    const artifact = await StudioArtifact.create({
      workspaceId,
      userId: effectiveUserId,
      sourceId: source.sourceId,
      type: "quiz",
      title: title || quizData.quizTitle || `${source.title} Quiz`,
      data: quizData,
      metadata: {
        sourceTitle: source.title,
        sourceType: source.sourceType,
        questionCount: quizData.questions?.length || 0,
        difficulty: quizOptions.difficulty,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Quiz generated successfully",
      artifact,
    });
  } catch (error) {
    console.error("[Studio Controller] generateQuiz error:", error);
    return res.status(400).json({ error: error.message });
  }
}

/**
 * POST /api/studio/mindmap
 * Generate and save Mind Map tree artifact.
 */
export async function generateMindMap(req, res) {
  try {
    const { workspaceId, sourceId, title, options } = req.body;
    const userId = req.user?._id;

    const { workspace, source, effectiveUserId } = await resolveWorkspaceAndSource(workspaceId, sourceId, userId);

    const mindmapData = await generateMindMapArtifact({
      sourceTitle: source.title,
      sourceType: source.sourceType,
      summaryOutline: source.summaryOutline,
      workspaceTitle: workspace.title,
      options: options || {},
    });

    const artifact = await StudioArtifact.create({
      workspaceId,
      userId: effectiveUserId,
      sourceId: source.sourceId,
      type: "mindmap",
      title: title || mindmapData.mapTitle || `${source.title} Mind Map`,
      data: mindmapData,
      metadata: {
        sourceTitle: source.title,
        sourceType: source.sourceType,
        branchCount: mindmapData.rootNode?.branches?.length || 0,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Mind map generated successfully",
      artifact,
    });
  } catch (error) {
    console.error("[Studio Controller] generateMindMap error:", error);
    return res.status(400).json({ error: error.message });
  }
}

/**
 * POST /api/studio/audio-overview
 * Generate and save 2-host podcast Audio Overview script.
 */
export async function generateAudioOverview(req, res) {
  try {
    const { workspaceId, sourceId, title, options } = req.body;
    const userId = req.user?._id;

    const { workspace, source, effectiveUserId } = await resolveWorkspaceAndSource(workspaceId, sourceId, userId);

    const audioData = await generateAudioOverviewArtifact({
      sourceTitle: source.title,
      sourceType: source.sourceType,
      summaryOutline: source.summaryOutline,
      workspaceTitle: workspace.title,
      options: options || {},
    });

    const artifact = await StudioArtifact.create({
      workspaceId,
      userId: effectiveUserId,
      sourceId: source.sourceId,
      type: "audio_overview",
      title: title || audioData.episodeTitle || `${source.title} Audio Overview`,
      data: audioData,
      metadata: {
        sourceTitle: source.title,
        sourceType: source.sourceType,
        dialogueTurns: audioData.dialogue?.length || 0,
        durationMinutesEstimate: audioData.durationMinutesEstimate || 5,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Audio overview script generated successfully",
      artifact,
    });
  } catch (error) {
    console.error("[Studio Controller] generateAudioOverview error:", error);
    return res.status(400).json({ error: error.message });
  }
}


