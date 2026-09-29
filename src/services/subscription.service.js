import mongoose from "mongoose";
import User from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Plan } from "../models/plan.model.js";
import { razorpay } from "../lib/razorpay.js";

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

/**
 * Fetches all Razorpay invoices associated with a user's subscriptions.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Array<object>>} Sorted array of formatted invoice objects
 */
export async function getUserInvoices(userId) {
  if (!userId) return [];

  // Find all subscriptions ever created for this user
  const subscriptions = await Subscription.find({ user: userId }).sort({ createdAt: -1 });
  if (!subscriptions || subscriptions.length === 0) {
    return [];
  }

  // Pre-load plans for plan name mapping
  const plans = await Plan.find({}).lean();
  const planMap = new Map(plans.map((p) => [p.key, p]));

  // Build a lookup of subscriptionId -> subscription details
  const subMap = new Map(subscriptions.map((s) => [s.razorpaySubscriptionId, s]));

  // Fetch invoices for each subscription in parallel
  const invoicePromises = subscriptions
    .filter((s) => Boolean(s.razorpaySubscriptionId))
    .map(async (sub) => {
      try {
        const response = await razorpay.invoices.all({
          subscription_id: sub.razorpaySubscriptionId,
          count: 100,
        });
        return response?.items || [];
      } catch (err) {
        console.warn(`[getUserInvoices] Failed to fetch invoices for sub ${sub.razorpaySubscriptionId}:`, err?.message || err);
        return [];
      }
    });

  const settledResults = await Promise.allSettled(invoicePromises);
  const rawInvoices = [];
  for (const res of settledResults) {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      rawInvoices.push(...res.value);
    }
  }

  // Format and enrich invoice data
  const formattedInvoices = rawInvoices.map((inv) => {
    const sub = subMap.get(inv.subscription_id);
    const planKey = sub?.planKey || inv.notes?.planKey || "pro_monthly";
    const plan = planMap.get(planKey);

    const paidTimestamp = inv.paid_at || inv.issued_at || inv.created_at;
    const paidDate = paidTimestamp ? new Date(paidTimestamp * 1000) : null;
    const billingStart = inv.billing_start ? new Date(inv.billing_start * 1000) : null;
    const billingEnd = inv.billing_end ? new Date(inv.billing_end * 1000) : null;

    const amountInPaise = inv.amount || inv.amount_paid || 0;
    const amountInRupees = (amountInPaise / 100).toFixed(2);

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number || inv.id,
      receipt: inv.receipt || null,
      orderId: inv.order_id || null,
      paymentId: inv.payment_id || null,
      subscriptionId: inv.subscription_id || null,
      planKey,
      planName: plan?.name || (planKey.includes("pro") ? "ChaiLM Pro" : "ChaiLM Standard"),
      status: inv.status || "paid",
      amount: amountInPaise,
      amountFormatted: `₹${amountInRupees}`,
      amountPaid: inv.amount_paid || 0,
      amountDue: inv.amount_due || 0,
      currency: inv.currency || "INR",
      date: paidDate,
      billingStart,
      billingEnd,
      shortUrl: inv.short_url || null,
      pdfUrl: inv.short_url ? `${inv.short_url}/pdf` : null,
      downloadUrl: inv.short_url || null,
      createdAt: inv.created_at ? new Date(inv.created_at * 1000) : null,
    };
  });

  // Sort latest first
  formattedInvoices.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.date ? new Date(b.date).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
  });

  return formattedInvoices;
}

