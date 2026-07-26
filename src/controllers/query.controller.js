import { processQueryPipeline } from "../services/query.service.js";

/**
 * Controller to handle RAG queries
 * Endpoint: POST /query
 */
export async function handleQuery(req, res) {
  try {
    const { query, sessionId, selectedSourceIds } = req.body;

    // 1. Validation
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({
        error: "Field 'query' (non-empty string) is required",
      });
    }

    if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return res.status(400).json({
        error: "Field 'sessionId' is required to scope retrieval to your workspace/chat",
      });
    }

    // 2. Execute RAG Pipeline (Single LLM Translation + HyDE + Scoped Vector Search + RRF)
    const result = await processQueryPipeline({
      query: query.trim(),
      sessionId: sessionId.trim(),
      selectedSourceIds: Array.isArray(selectedSourceIds) ? selectedSourceIds : [],
    });

    console.log('RESULT: ', result)
    // 3. Return response with cited sources
    return res.status(200).json({
      message: "Query processed successfully",
      data: {
        query: result.query,
        answer: result.answer,
        translations: result.translations,
        hyde: result.hyde,
        sources: result.sources, // Structured array of chunks with videoId, startSeconds, titles
      },
    });
  } catch (error) {
    console.error("Query Controller Error:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred while processing your query",
    });
  }
}