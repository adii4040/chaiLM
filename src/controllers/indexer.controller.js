import { processAndIndexDocument } from "../services/indexer.service.js";

/**
 * Controller to handle document ingestion for PDFs, YouTube videos, and Websites.
 * Endpoint: POST /api/indexer
 */
export async function handleIndexDocument(req, res) {
  try {
    const { type, url, workspaceId } = req.body;
    const userId = req.user?._id;

    const hasFile = Boolean(req.file);
    const hasUrl = Boolean(url && typeof url === "string" && url.trim().length > 0);

    // 1. Validate required workspaceId and userId
    if (!workspaceId || typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
      return res.status(400).json({ error: "Field 'workspaceId' is required to scope documents" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized user" });
    }

    // 2. Validate type
    if (!type || typeof type !== "string") {
      return res.status(400).json({ error: "Field 'type' (pdf | youtube | website) is required" });
    }

    const normalizedType = type.trim().toLowerCase();

    // 3. Enforce mutual exclusion
    if (hasFile && hasUrl) {
      return res.status(400).json({
        error: "Conflicting inputs provided: Please upload either a PDF file OR provide a URL, not both.",
      });
    }

    let payload = {
      type: normalizedType,
      workspaceId: workspaceId.trim(),
      userId,
    };

    // 4. Validate source-specific payload inputs
    if (normalizedType === "pdf") {
      if (!hasFile) {
        return res.status(400).json({ error: "PDF file upload is required under key 'file'" });
      }
      payload.filePath = req.file.path;
      payload.originalName = req.file.originalname;
    } else if (normalizedType === "youtube" || normalizedType === "website") {
      if (!hasUrl) {
        return res.status(400).json({
          error: `Field 'url' is required for '${normalizedType}' indexing`,
        });
      }
      payload.url = url.trim();
    } else {
      return res.status(400).json({
        error: "Invalid document type. Allowed types are 'pdf', 'youtube', or 'website'",
      });
    }

    console.log(`[Indexer Controller] Processing ${normalizedType} document for workspace: ${payload.workspaceId} (user: ${userId})`);

    // 5. Execute processing and vector indexing
    const result = await processAndIndexDocument(payload);

    return res.status(200).json({
      message: "Document successfully indexed",
      data: result,
    });
  } catch (error) {
    console.error("Indexing Controller Error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || "Failed to process and index document",
    });
  }
}