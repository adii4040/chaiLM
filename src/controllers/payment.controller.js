import crypto from "crypto";
import { razorpay } from "../lib/razorpay.js";
import { config } from "../config/env.js";

/**
 * Creates a Razorpay Order for Standard Checkout
 * Endpoint: POST /api/create-order or POST /api/payment/create-order
 * Request Body: { amount (in paise, >= 100), currency (default 'INR'), receipt, notes }
 * Response: { success: true, order_id, id, amount, currency, receipt, key }
 */
export async function createOrder(req, res) {
  try {
    const { amount, currency = "INR", receipt, notes = {} } = req.body ?? {};

    // 1. Validation: Amount must exist and be >= 100 paise (₹1)
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        message: "Amount is required and must be a valid number in paise.",
      });
    }

    const numericAmount = Math.round(Number(amount));
    if (numericAmount < 100) {
      return res.status(400).json({
        success: false,
        message: "Amount must be at least 100 paise (₹1).",
      });
    }

    // 2. Call Razorpay API to create standard order
    const orderOptions = {
      amount: numericAmount,
      currency: (currency || "INR").toUpperCase(),
      receipt: receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      notes: {
        ...notes,
        ...(req.user?._id ? { userId: String(req.user._id) } : {}),
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    // 3. Return order details
    return res.status(200).json({
      success: true,
      order_id: order.id,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      key: config.razorpay?.keyId || process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay createOrder error:", err);

    // Razorpay authentication error (invalid key/secret)
    if (err?.statusCode === 401 || (err?.error?.code === "BAD_REQUEST_ERROR" && err?.error?.description?.toLowerCase().includes("auth"))) {
      return res.status(401).json({
        success: false,
        message: "Razorpay authentication failed. Please check your API credentials.",
        error: err?.error?.description || err?.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: err?.error?.description || err?.message || "Failed to create Razorpay order.",
    });
  }
}

/**
 * Verifies Razorpay Payment Signature for Standard Checkout
 * Endpoint: POST /api/verify-payment or POST /api/payment/verify-payment
 * Request Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 */
export async function verifyPayment(req, res) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
      payment_id,
      signature,
      orderId,
      paymentId,
    } = req.body ?? {};

    const targetOrderId = razorpay_order_id || order_id || orderId;
    const targetPaymentId = razorpay_payment_id || payment_id || paymentId;
    const targetSignature = razorpay_signature || signature;

    // 1. Missing fields validation
    if (!targetOrderId || !targetPaymentId || !targetSignature) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
      });
    }

    // 2. Retrieve Razorpay Key Secret from config / environment
    const secret = config.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("RAZORPAY_KEY_SECRET is not configured");
      return res.status(500).json({
        success: false,
        message: "Payment configuration error: secret key missing.",
      });
    }

    // 3. Generate expected HMAC-SHA256 signature
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${targetOrderId}|${targetPaymentId}`)
      .digest("hex");

    // 4. Constant-time signature comparison to prevent timing attacks
    const isSignatureValid =
      generatedSignature.length === targetSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature, "utf-8"),
        Buffer.from(targetSignature, "utf-8")
      );

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature. Verification failed.",
      });
    }

    // 5. Payment verified successfully
    return res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      order_id: targetOrderId,
      payment_id: targetPaymentId,
    });
  } catch (err) {
    console.error("Razorpay verifyPayment error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to verify payment signature.",
    });
  }
}
