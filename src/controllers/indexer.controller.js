import { processAndIndexDocument } from "../services/indexer.service.js";

export async function handleIndexDocument(req, res) {
  try {
    const { type, url, sessionId } = req.body;

    // Validate that a sessionId was passed so sources aren't orphaned
    if (!sessionId) {
      return res.status(400).json({ error: "Field 'sessionId' is required to scope documents" });
    }

    if (!type) {
      return res.status(400).json({ error: "Field 'type' (pdf | youtube | website) is required" });
    }

    let payload = {
      type,
      sessionId // Forwarding sessionId into payload
    };

    console.log(`Parsing ${type} Documnets....`);

    if (type === "pdf") {
      if (!req.file) {
        return res.status(400).json({ error: "PDF file is required under key 'file'" });
      }
      payload.filePath = req.file.path;
      payload.originalName = req.file.originalname;
    } else if (type === "youtube" || type === "website") {
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Field 'url' is required for youtube or website indexing" });
      }
      payload.url = url.trim();
    } else {
      return res.status(400).json({ error: "Invalid type. Must be 'pdf', 'youtube', or 'website'" });
    }

    console.log('PAYLOAD: ', payload);

    // Phase 1: Process synchronously without worker
    const result = await processAndIndexDocument(payload);

    return res.status(200).json({
      message: "Document successfully indexed",
      data: result,
    });
  } catch (error) {
    console.error("Indexing Controller Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to process and index document",
    });
  }
}