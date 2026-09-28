import { applyRazorpaySubscriptionToDb } from "../../../services/subscription.service.js";
import { getOrCreateUserUsage } from "../../../services/usage.service.js";

/**
 * Handles the 'subscription.charged' webhook event.
 * Fired when a recurring subscription payment succeeds (Month 1, Month 2, Month 3...).
 *
 * @param {object} payload - Razorpay webhook payload
 * @returns {Promise<object>} Result summary
 */
export async function handleSubscriptionCharged(payload) {
  const subEntity = payload?.subscription?.entity;
  const paymentEntity = payload?.payment?.entity;

  if (!subEntity?.id) {
    throw new Error("Missing subscription entity in subscription.charged payload");
  }

  console.log(`[Webhook:subscription.charged] Processing for subId: ${subEntity.id}, paymentId: ${paymentEntity?.id}`);

  // 1. Sync subscription entity to MongoDB and update User document
  const { subscription, user } = await applyRazorpaySubscriptionToDb(subEntity);

  // 2. Pre-initialize fresh usage quotas for the new billing cycle
  if (user?._id) {
    await getOrCreateUserUsage(user._id);
  }

  console.log(`[Webhook:subscription.charged] Success for userId: ${user?._id || subscription?.user}, Plan: ${user?.plan}`);

  return { subscriptionId: subEntity.id, status: subEntity.status, userId: user?._id };
}
