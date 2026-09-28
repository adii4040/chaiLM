import { applyRazorpaySubscriptionToDb } from "../../../services/subscription.service.js";

/**
 * Handles 'subscription.halted' and 'subscription.pending' webhook events.
 * Fired when auto-debit fails (pending retry or permanently halted).
 *
 * @param {object} payload - Razorpay webhook payload
 * @returns {Promise<object>} Result summary
 */
export async function handleSubscriptionHalted(payload) {
  const subEntity = payload?.subscription?.entity;

  if (!subEntity?.id) {
    throw new Error("Missing subscription entity in halted/pending payload");
  }

  console.warn(`[Webhook:subscription.halted/pending] Status: ${subEntity.status} for subId: ${subEntity.id}`);

  const { subscription, user } = await applyRazorpaySubscriptionToDb(subEntity);

  return { subscriptionId: subEntity.id, status: subEntity.status, userId: user?._id };
}
