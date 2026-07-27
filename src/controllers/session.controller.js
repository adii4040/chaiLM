import { Session } from "../models/Session.js";
import { ChatMessage } from "../models/ChatMessage.js";

export async function handleGetSessionData(req, res) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Fetch session metadata and chat history in parallel
    const [sessionDoc, chatHistory] = await Promise.all([
      Session.findOne({ sessionId }),
      ChatMessage.find({ sessionId }).sort({ createdAt: 1 }),
    ]);

    return res.status(200).json({
      message: "Session hydrated successfully",
      data: {
        sessionId,
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
