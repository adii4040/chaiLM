import { applyRazorpaySubscriptionToDb } from "../../../services/subscription.service.js";

/**
 * Handles 'subscription.authenticated' and 'subscription.activated' webhook events.
 * Fired when user mandate is authorized or subscription becomes active.
 *
 * @param {object} payload - Razorpay webhook payload
 * @returns {Promise<object>} Result summary
 */
export async function handleSubscriptionActivated(payload) {
  const subEntity = payload?.subscription?.entity;

  if (!subEntity?.id) {
    throw new Error("Missing subscription entity in activation payload");
  }

  console.log(`[Webhook:subscription.activated] Processing for subId: ${subEntity.id}, status: ${subEntity.status}`);

  const { subscription, user } = await applyRazorpaySubscriptionToDb(subEntity);

  return { subscriptionId: subEntity.id, status: subEntity.status, userId: user?._id };
}
