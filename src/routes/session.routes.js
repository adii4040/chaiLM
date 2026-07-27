import { Router } from "express";
import { handleGetSessionData } from "../controllers/session.controller.js";

const router = Router();

router.get("/:sessionId", handleGetSessionData);

export default router;
