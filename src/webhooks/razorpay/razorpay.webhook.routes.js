import { Router } from "express";
import { handleRazorpayWebhook } from "./razorpay.webhook.controller.js";

const router = Router();

/**
 * Public Webhook endpoint for Razorpay.
 * No user JWT authentication middleware is applied here.
 * Authenticated cryptographically via HMAC-SHA256 signature in headers.
 */
router.post("/", handleRazorpayWebhook);

export default router;
