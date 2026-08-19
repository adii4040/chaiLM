import mongoose from "mongoose";
import { Workspace } from "../models/Workspace.model.js";
import { ChatMessage } from "../models/ChatMessage.model.js";

const DEFAULT_TEST_USER_ID = new mongoose.Types.ObjectId("6a6a422aae65f98e696535e9");

/**
 * Controller to create a new workspace
 * Endpoint: POST /api/workspace
 * Request body: { title: string, userId?: string }
 */
export async function handleCreateWorkspace(req, res) {
  try {
    const { title } = req.body;
    const userId = req.user?._id || req.body.userId || DEFAULT_TEST_USER_ID;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "Title is required to create a workspace" });
    }

    const newWorkspace = new Workspace({
      userId,
      title: title.trim(),
      sources: [],
    });

    await newWorkspace.save();

    return res.status(201).json({
      message: "Workspace created successfully",
      data: {
        workspaceId: newWorkspace.workspaceId || newWorkspace._id.toString(),
        title: newWorkspace.title,
        sources: newWorkspace.sources,
        createdAt: newWorkspace.createdAt,
        updatedAt: newWorkspace.updatedAt,
      },
    });
  } catch (error) {
    console.error("Create Workspace Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to create workspace",
    });
  }
}

/**
 * Controller to fetch workspace details and chat history
 * Endpoint: GET /api/workspace/:workspaceId
 */
export async function handleGetWorkspaceData(req, res) {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace ID is required" });
    }

    const query = { workspaceId };
    if (userId) query.userId = userId;

    const [workspaceDoc, chatHistory] = await Promise.all([
      Workspace.findOne(query),
      ChatMessage.find(query).sort({ createdAt: 1 }),
    ]);

    if (!workspaceDoc) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const formattedSources = (workspaceDoc.sources || []).map((s) => ({
      sourceId: s.sourceId || s._id.toString(),
      title: s.title,
      sourceType: s.sourceType,
      sourceUrl: s.sourceUrl,
      status: s.status || "COMPLETED",
      errorMessage: s.errorMessage || null,
      cloudinaryUrl: s.cloudinaryUrl || null,
      videoId: s.videoId || null,
      studioOutlineStatus: s.studioOutlineStatus || "NOT_STARTED",
      studioOutlineError: s.studioOutlineError || null,
      summaryOutline: s.summaryOutline || null,
      indexedAt: s.indexedAt,
    }));

    return res.status(200).json({
      message: "Workspace hydrated successfully",
      data: {
        workspaceId: workspaceDoc.workspaceId || workspaceDoc._id.toString(),
        title: workspaceDoc.title,
        sources: formattedSources,
        history: chatHistory.map((msg) => ({
          id: msg._id,
          role: msg.role,
          query: msg.query,
          answer: msg.answer,
          sources: msg.sources,
          createdAt: msg.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Get Workspace Data Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to retrieve workspace data",
    });
  }
}

/**
 * Controller to fetch all user workspaces
 * Endpoint: GET /api/workspace
 */
export async function handleGetAllWorkspaces(req, res) {
  try {
    const userId = req.user?._id;
    const query = userId ? { userId } : {};

    const workspaces = await Workspace.find(query)
      .select("workspaceId title sources createdAt updatedAt")
      .sort({ updatedAt: -1 });

    const formattedWorkspaces = workspaces.map((ws) => ({
      workspaceId: ws.workspaceId || ws._id.toString(),
      title: ws.title,
      sourceCount: ws.sources ? ws.sources.length : 0,
      sourcesSummary: (ws.sources || []).map((s) => ({
        sourceId: s.sourceId || s._id.toString(),
        title: s.title,
        sourceType: s.sourceType,
        sourceUrl: s.sourceUrl,
        status: s.status || "COMPLETED",
        errorMessage: s.errorMessage || null,
        cloudinaryUrl: s.cloudinaryUrl || null,
        videoId: s.videoId || null,
        studioOutlineStatus: s.studioOutlineStatus || "NOT_STARTED",
        indexedAt: s.indexedAt,
      })),
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
    }));

    return res.status(200).json({
      message: "Workspaces retrieved successfully",
      data: formattedWorkspaces,
    });
  } catch (error) {
    console.error("Get All Workspaces Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to retrieve workspaces",
    });
  }
}

/**
 * Controller to delete a workspace
 * Endpoint: DELETE /api/workspace/:workspaceId
 */
export async function handleDeleteWorkspace(req, res) {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace ID is required" });
    }

    const query = { workspaceId };
    if (userId) query.userId = userId;

    const workspaceDoc = await Workspace.findOne(query);
    if (!workspaceDoc) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    await Promise.all([
      Workspace.deleteOne(query),
      ChatMessage.deleteMany(query),
    ]);

    return res.status(200).json({
      message: "Workspace deleted successfully",
      data: { workspaceId },
    });
  } catch (error) {
    console.error("Delete Workspace Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to delete workspace",
    });
  }
}

