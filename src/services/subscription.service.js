import mongoose from "mongoose";
import User from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";

/**
 * Statuses that grant active plan entitlements to the user.
 * (Note: "created" means initiated but unpaid, so it does not grant paid access)
 */
const ACTIVE_USER_STATUSES = ["authenticated", "active", "pending", "paused"];

/**
 * Synchronizes the denormalized subscription fields on the User document.
 * Reads the latest live subscription from the Subscription collection.
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<import("../models/user.model.js").default>} Updated user document
 */
export async function syncUserSubscription(userId) {
  if (!userId) return null;

  // Find the most recent active/live subscription for this user
  const liveSubscription = await Subscription.findOne({
    user: userId,
    status: { $in: ACTIVE_USER_STATUSES },
  }).sort({ createdAt: -1 });

  if (liveSubscription) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          plan: liveSubscription.planKey,
          subscriptionStatus: liveSubscription.status,
          planExpiresAt: liveSubscription.currentEnd || null,
          subscription: liveSubscription._id,
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    return updatedUser;
  }

  // If no live subscription exists, reset user to the default free plan
  const fallbackUser = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        plan: "free",
        subscriptionStatus: "none",
        planExpiresAt: null,
        subscription: null,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return fallbackUser;
}

/**
 * Reusable service function to update a Subscription document from a Razorpay
 * subscription entity (from fetch API or Webhooks), and synchronize the User record.
 * 
 * @param {object} rzpSubEntity - The Razorpay subscription entity
 * @param {string|mongoose.Types.ObjectId} [userId] - Optional fallback user ID
 * @returns {Promise<{ subscription: object, user: object }>}
 */
export async function applyRazorpaySubscriptionToDb(rzpSubEntity, userId = null) {
  if (!rzpSubEntity?.id) {
    throw new Error("Invalid Razorpay subscription entity: missing subscription ID");
  }

  // Convert Razorpay's unix timestamps (seconds) to JavaScript Date objects
  const currentStart = rzpSubEntity.current_start
    ? new Date(rzpSubEntity.current_start * 1000)
    : undefined;

  const currentEnd = rzpSubEntity.current_end
    ? new Date(rzpSubEntity.current_end * 1000)
    : undefined;

  const updateFields = {
    status: rzpSubEntity.status,
    totalCount: rzpSubEntity.total_count,
  };

  if (rzpSubEntity.cancel_at_cycle_end !== undefined || rzpSubEntity.ended_at) {
    updateFields.cancelAtCycleEnd = Boolean(rzpSubEntity.ended_at || rzpSubEntity.cancel_at_cycle_end);
  }

  if (currentStart) updateFields.currentStart = currentStart;
  if (currentEnd) updateFields.currentEnd = currentEnd;

  let subscription = await Subscription.findOne({
    razorpaySubscriptionId: rzpSubEntity.id,
  });

  if (subscription) {
    Object.assign(subscription, updateFields);
    await subscription.save();
  } else if (userId && rzpSubEntity.plan_id) {
    subscription = await Subscription.create({
      user: userId,
      planKey: rzpSubEntity.notes?.planKey || "pro_monthly",
      razorpayPlanId: rzpSubEntity.plan_id,
      razorpaySubscriptionId: rzpSubEntity.id,
      cancelAtCycleEnd: Boolean(rzpSubEntity.ended_at || rzpSubEntity.cancel_at_cycle_end),
      ...updateFields,
    });
  } else {
    throw new Error(`Subscription not found for Razorpay ID: ${rzpSubEntity.id}`);
  }

  const resolvedUserId = subscription.user || userId;
  const syncedUser = await syncUserSubscription(resolvedUserId);

  return { subscription, user: syncedUser };
}

/**
 * Evaluates the effective active plan for a user.
 * 
 * - If user or user.plan is missing or "free", returns "free".
 * - If the plan has expired (planExpiresAt <= Date.now()), triggers lazy background DB cleanup and returns "free".
 * - If user subscription status is active (or cancelled with future planExpiresAt), returns user.plan.
 * - Otherwise falls back to "free".
 * 
 * @param {object} user - User document or req.user object
 * @returns {string} Effective plan key, e.g. "free" or "pro_monthly"
 */
export function getEffectivePlan(user) {
  if (!user || !user.plan || user.plan === "free") {
    return "free";
  }

  const now = Date.now();

  // If user has a plan expiration date and it has passed:
  if (user.planExpiresAt && new Date(user.planExpiresAt).getTime() <= now) {
    // Lazy non-blocking DB cleanup
    if (user._id && mongoose.isValidObjectId(user._id)) {
      User.findByIdAndUpdate(user._id, {
        $set: {
          plan: "free",
          subscriptionStatus: "expired",
          planExpiresAt: null,
          subscription: null,
        },
      }).catch((err) => console.error("Lazy plan cleanup failed:", err?.message || err));
    }
    return "free";
  }

  // Active status check
  const isStatusActive = ACTIVE_USER_STATUSES.includes(user.subscriptionStatus);
  const hasFutureExpiry = user.planExpiresAt && new Date(user.planExpiresAt).getTime() > now;

  // Even if status was marked cancelled/pending-cancel, user retains access if future expiry date exists
  if (isStatusActive || hasFutureExpiry) {
    return user.plan;
  }

  return "free";
}

/**
 * Returns detailed effective plan status for a user.
 * 
 * @param {object} user 
 * @returns {{ plan: string, isActive: boolean, isExpired: boolean, expiresAt: Date|null, status: string }}
 */
export function getEffectivePlanDetails(user) {
  const plan = getEffectivePlan(user);
  const now = Date.now();
  const expiresAt = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const isExpired = Boolean(expiresAt && expiresAt.getTime() <= now);
  const isActive = plan !== "free";

  return {
    plan,
    isActive,
    isExpired,
    expiresAt,
    status: user?.subscriptionStatus || "none",
  };
}
