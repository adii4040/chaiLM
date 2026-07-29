import { Session } from "../models/Session.js";
import { ChatMessage } from "../models/ChatMessage.js";

export async function handleGetSessionData(req, res) {
  try {
    const { sessionId } = req.params;
    const userId = req.user?._id;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    // Fetch user-scoped session metadata and chat history in parallel
    const [sessionDoc, chatHistory] = await Promise.all([
      Session.findOne({ sessionId, userId }),
      ChatMessage.find({ sessionId, userId }).sort({ createdAt: 1 }),
    ]);

    return res.status(200).json({
      message: "Session hydrated successfully",
      data: {
        sessionId,
        title: sessionDoc?.title || "Untitled Workspace",
        sources: sessionDoc?.sources || [],
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
    console.error("Get Session Data Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to retrieve session data",
    });
  }
}

export async function handleGetAllSessions(req, res) {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    const sessions = await Session.find({ userId })
      .select("sessionId title sources.title sources.sourceType createdAt updatedAt")
      .sort({ updatedAt: -1 });

    const formattedSessions = sessions.map((session) => ({
      sessionId: session.sessionId,
      title: session.title,
      sourceCount: session.sources ? session.sources.length : 0,
      sourcesSummary: session.sources || [],
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));

    return res.status(200).json({
      message: "Sessions retrieved successfully",
      data: formattedSessions,
    });
  } catch (error) {
    console.error("Get All Sessions Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to retrieve sessions",
    });
  }
}

export async function handleDeleteSession(req, res) {
  try {
    const { sessionId } = req.params;
    const userId = req.user?._id;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    await Promise.all([
      Session.deleteOne({ sessionId, userId }),
      ChatMessage.deleteMany({ sessionId, userId }),
    ]);

    return res.status(200).json({
      message: "Workspace deleted successfully",
      data: { sessionId },
    });
  } catch (error) {
    console.error("Delete Session Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to delete session",
    });
  }
}
