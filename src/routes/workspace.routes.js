import { Router } from "express";
import {
  handleCreateWorkspace,
  handleGetWorkspaceData,
  handleGetAllWorkspaces,
  handleDeleteWorkspace,
} from "../controllers/workspace.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

// router.use(verifyJwt); // Disabled for unauthenticated testing

router.post("/", handleCreateWorkspace);

router.get("/", handleGetAllWorkspaces);
router.get("/:workspaceId", handleGetWorkspaceData);
router.delete("/:workspaceId", handleDeleteWorkspace);

export default router;
