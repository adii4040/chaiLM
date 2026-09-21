import { Router } from "express";
import {
    createSubscription,
    verifySubscription,
    getBillingDetails,
    cancelSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

// Protect all subscription endpoints
router.use(verifyJwt);

router.post("/create", createSubscription);
router.post("/verify", verifySubscription);
router.get("/me", getBillingDetails);
router.post("/cancel", cancelSubscription);

export default router;
