import { Router } from "express";
import multer from "multer";
import { upload } from "../middlewares/multer.middlewares.js";
import { handleIndexDocument, handleGetSessionSources } from "../controllers/indexer.controller.js";

const router = Router();

const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

router.post("/", handleUpload, handleIndexDocument);
router.get("/session/:sessionId", handleGetSessionSources);

export default router;