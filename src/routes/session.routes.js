import { Router } from "express";
import { handleGetSessionData, handleGetAllSessions, handleDeleteSession } from "../controllers/session.controller.js";

const router = Router();

router.get("/", handleGetAllSessions);
router.get("/:sessionId", handleGetSessionData);
router.delete("/:sessionId", handleDeleteSession);

export default router;
