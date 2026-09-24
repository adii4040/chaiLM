import { Router } from "express";
import { verifyJwt } from "../middlewares/auth.middleware.js";
import { checkStudioArtifactLimit } from "../middlewares/entitlement.middleware.js";
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

// Studio Feature Generation Endpoints (with Entitlement and Quota Guards)
router.post("/outline", ensureStudioOutline);
router.post("/study-guide", checkStudioArtifactLimit("study_guide"), generateStudyGuide);
router.post("/flashcards", checkStudioArtifactLimit("flashcards"), generateFlashcards);
router.post("/quiz", checkStudioArtifactLimit("quiz"), generateQuiz);
router.post("/mindmap", checkStudioArtifactLimit("mindmap"), generateMindMap);
router.post("/audio-overview", checkStudioArtifactLimit("audio_overview"), generateAudioOverview);

export default router;
