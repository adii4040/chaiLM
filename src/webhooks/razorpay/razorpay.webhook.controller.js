import crypto from "crypto";
import { config } from "../../config/env.js";
import { dispatchRazorpayWebhookEvent } from "./index.js";

/**
 * Controller to verify HMAC-SHA256 signature and process incoming Razorpay webhooks.
 */
export async function handleRazorpayWebhook(req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      console.warn("[Webhook:Razorpay] Missing 'x-razorpay-signature' header");
      return res.status(400).json({ success: false, message: "Missing signature header" });
    }

    const secret = config.razorpay?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Webhook:Razorpay] CRITICAL: RAZORPAY_WEBHOOK_SECRET is not configured in server environment");
      return res.status(500).json({ success: false, message: "Webhook secret not configured" });
    }

    // Retrieve raw body buffer for authentic HMAC validation
    const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

    // Generate expected HMAC-SHA256 hash
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBodyBuffer)
      .digest("hex");

    // Timing-safe signature comparison to protect against timing attacks
    const isSignatureValid =
      expectedSignature.length === signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf-8"),
        Buffer.from(signature, "utf-8")
      );

    if (!isSignatureValid) {
      console.warn("[Webhook:Razorpay] Invalid webhook signature detected. Rejecting request.");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const { event, payload } = req.body || {};

    if (!event) {
      return res.status(400).json({ success: false, message: "Missing event name in payload" });
    }

    console.log(`[Webhook:Razorpay] Received verified event: '${event}' (Event ID: ${req.headers["x-razorpay-event-id"] || "N/A"})`);

    // Asynchronously dispatch the event to the registered handler
    const result = await dispatchRazorpayWebhookEvent(event, payload);

    return res.status(200).json({
      received: true,
      event,
      result,
    });
  } catch (err) {
    console.error("[Webhook:Razorpay] Error processing webhook:", err);
    return res.status(500).json({
      success: false,
      message: "Webhook handler failed",
    });
  }
}
