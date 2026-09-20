import { ChatMessage } from "../models/ChatMessage.model.js";
import { processQueryPipeline } from "../services/query.service.js";

/**
 * Controller to handle RAG queries
 * Endpoint: POST /api/query
 */
export async function handleQuery(req, res) {
  const { query, workspaceId, selectedSourceIds } = req.body;
  const userId = req.user?._id;

  try {
    // 1. Validation
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({
        error: "Field 'query' (non-empty string) is required",
      });
    }

    if (!workspaceId || typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
      return res.status(400).json({
        error: "Field 'workspaceId' is required to scope retrieval to your workspace",
      });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    // 2. Execute RAG Pipeline with user scope
    const result = await processQueryPipeline({
      query: query.trim(),
      workspaceId: workspaceId.trim(),
      userId,
      selectedSourceIds: Array.isArray(selectedSourceIds) ? selectedSourceIds : [],
    });

    console.log('[Query Controller] Result generated successfully for user:', userId);

    // 3. Return response with cited sources
    return res.status(200).json({
      message: "Query processed successfully",
      data: {
        query: result.query,
        answer: result.answer,
        translations: result.translations,
        hyde: result.hyde,
        sources: result.sources,
      },
    });
  } catch (error) {
    console.error("Query Controller Error:", error);
    const errorMessage = error.message || "An unexpected error occurred while processing your query";

    // Persist user query and error response to ChatMessage so history is preserved across refreshes
    if (query && workspaceId && userId) {
      try {
        await Promise.all([
          ChatMessage.create({
            workspaceId: String(workspaceId).trim(),
            userId,
            role: "user",
            query: String(query).trim(),
          }),
          ChatMessage.create({
            workspaceId: String(workspaceId).trim(),
            userId,
            role: "assistant",
            isError: true,
            error: errorMessage,
          }),
        ]);
      } catch (dbErr) {
        console.error("[Query Controller] Failed to persist error ChatMessages to MongoDB:", dbErr);
      }
    }

    return res.status(error.statusCode || 500).json({
      error: errorMessage,
    });
  }
}