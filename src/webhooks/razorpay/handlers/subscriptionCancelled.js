import { applyRazorpaySubscriptionToDb } from "../../../services/subscription.service.js";

/**
 * Handles 'subscription.cancelled', 'subscription.completed', 'subscription.paused', 'subscription.resumed' webhook events.
 *
 * @param {object} payload - Razorpay webhook payload
 * @returns {Promise<object>} Result summary
 */
export async function handleSubscriptionCancelled(payload) {
  const subEntity = payload?.subscription?.entity;

  if (!subEntity?.id) {
    throw new Error("Missing subscription entity in cancelled/completed payload");
  }

  console.log(`[Webhook:subscription.cancelled/completed] Status: ${subEntity.status} for subId: ${subEntity.id}`);

  const { subscription, user } = await applyRazorpaySubscriptionToDb(subEntity);

  return { subscriptionId: subEntity.id, status: subEntity.status, userId: user?._id };
}
