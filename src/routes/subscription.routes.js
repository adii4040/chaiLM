import { Router } from "express";
import {
    createSubscription,
    verifySubscription,
} from "../controllers/subscription.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

// Protect all subscription endpoints
router.use(verifyJwt);

router.post("/create", createSubscription);
router.post("/verify", verifySubscription);

export default router;
