import { Router } from "express";
import { handleGetSessionData, handleGetAllSessions, handleDeleteSession } from "../controllers/session.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJwt);

router.get("/", handleGetAllSessions);
router.get("/:sessionId", handleGetSessionData);
router.delete("/:sessionId", handleDeleteSession);

export default router;
