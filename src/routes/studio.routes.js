import { Router } from "express";
import { verifyJwt } from "../middlewares/auth.middleware.js";
import {
  getStudioArtifacts,
  getStudioArtifactById,
  deleteStudioArtifact,
  ensureStudioOutline,
  generateStudyGuide,
  generateFlashcards,
  generateQuiz,
  generateMindMap,
  generateAudioOverview,
} from "../controllers/studio.controller.js";

const router = Router();

router.use(verifyJwt);

// Studio Artifact Retrieval & Management

router.get("/", getStudioArtifacts);
router.get("/:artifactId", getStudioArtifactById);
router.delete("/:artifactId", deleteStudioArtifact);

// Studio Feature Generation Endpoints
router.post("/outline", ensureStudioOutline);
router.post("/study-guide", generateStudyGuide);
router.post("/flashcards", generateFlashcards);
router.post("/quiz", generateQuiz);
router.post("/mindmap", generateMindMap);
router.post("/audio-overview", generateAudioOverview);

export default router;
