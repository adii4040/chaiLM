import crypto from "crypto";
import { razorpay } from "../lib/razorpay.js";
import { Plan } from "../models/plan.model.js";
import { Subscription, LIVE_STATUSES } from "../models/subscription.model.js";
import { config } from "../config/env.js";
import { applyRazorpaySubscriptionToDb, getEffectivePlan } from "../services/subscription.service.js";
import { getPlanEntitlements } from "../config/planConfig.js";
import { getOrCreateUserUsage } from "../services/usage.service.js";

const TOTAL_COUNT_BY_PERIOD = { monthly: 120, yearly: 10 }; // verify against Razorpay's limits

export async function createSubscription(req, res) {
    try {
        const { planKey } = req.body ?? {};
        if (typeof planKey !== "string" || !planKey) {
            return res.status(400).json({ success: false, message: "planKey is required" });
        }
        const userId = req.user._id;

        const plan = await Plan.findOne({ key: planKey, isActive: true });
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

        const totalCount = TOTAL_COUNT_BY_PERIOD[plan.period];
        if (!totalCount) return res.status(400).json({ success: false, message: "Unsupported plan period" });

        const existing = await Subscription.findOne({ user: userId, status: { $in: LIVE_STATUSES } });
        if (existing) {
            // Unpaid one from an earlier click: reuse it if Razorpay still has it as "created"
            if (existing.status === "created" && existing.planKey === plan.key) {
                const remote = await razorpay.subscriptions.fetch(existing.razorpaySubscriptionId);
                if (remote.status === "created") {
                    return res.status(200).json({
                        success: true,
                        message: "Subscription ready",
                        subscriptionId: existing.razorpaySubscriptionId,
                    });
                }
                // Razorpay has moved on (e.g. expired). Record that, then continue if it's no longer live
                existing.status = remote.status;
                await existing.save();
            }
            if (LIVE_STATUSES.includes(existing.status)) {
                return res.status(409).json({ success: false, message: "You already have a subscription" });
            }
        }

        const rzpSub = await razorpay.subscriptions.create({
            plan_id: plan.razorpayPlanId,
            total_count: totalCount,
            customer_notify: 1,
            notes: { userId: String(userId), planKey: plan.key },
        });

        await Subscription.create({
            user: userId,
            planKey: plan.key,
            razorpayPlanId: plan.razorpayPlanId,
            razorpaySubscriptionId: rzpSub.id,
            status: rzpSub.status,
            totalCount,
        });

        return res.status(201).json({
            success: true,
            message: "Subscription created",
            subscriptionId: rzpSub.id
        });
    } catch (err) {
        console.error("createSubscription failed:", {
            userId: String(req.user?._id),
            statusCode: err?.statusCode,
            message: err?.error?.description ?? err?.message,
        });
        return res.status(500).json({ success: false, message: "Could not create subscription" });
    }
}

export async function verifySubscription(req, res) {
    try {
        const {
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature,
            razorpayPaymentId,
            razorpaySubscriptionId,
            razorpaySignature,
        } = req.body ?? {};

        const paymentId = razorpay_payment_id || razorpayPaymentId;
        const subscriptionId = razorpay_subscription_id || razorpaySubscriptionId;
        const signature = razorpay_signature || razorpaySignature;

        if (!paymentId || !subscriptionId || !signature) {
            return res.status(400).json({
                success: false,
                message: "razorpay_payment_id, razorpay_subscription_id, and razorpay_signature are required",
            });
        }

        const userId = req.user._id;

        // 1. Check ownership in our database
        const localSubscription = await Subscription.findOne({
            razorpaySubscriptionId: subscriptionId,
            user: userId,
        });

        if (!localSubscription) {
            return res.status(404).json({
                success: false,
                message: "Subscription not found for this user",
            });
        }

        // 2. Cryptographic signature check: HMAC-SHA256 of `${paymentId}|${subscriptionId}`
        const secret = config.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            console.error("RAZORPAY_KEY_SECRET is not configured");
            return res.status(500).json({ success: false, message: "Payment configuration error" });
        }

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(`${paymentId}|${subscriptionId}`)
            .digest("hex");

        const isSignatureValid =
            expectedSignature.length === signature.length &&
            crypto.timingSafeEqual(
                Buffer.from(expectedSignature, "utf-8"),
                Buffer.from(signature, "utf-8")
            );

        if (!isSignatureValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }

        // 3. Fetch authoritative status directly from Razorpay API
        const remoteSub = await razorpay.subscriptions.fetch(subscriptionId);

        // 4. Update Subscription in DB and sync User document
        const { subscription, user } = await applyRazorpaySubscriptionToDb(remoteSub, userId);

        return res.status(200).json({
            success: true,
            message: "Subscription verified successfully",
            plan: user?.plan || subscription.planKey,
            status: subscription.status,
            currentEnd: subscription.currentEnd,
        });
    } catch (err) {
        console.error("verifySubscription failed:", {
            userId: String(req.user?._id),
            statusCode: err?.statusCode,
            message: err?.error?.description ?? err?.message,
        });
        return res.status(500).json({
            success: false,
            message: "Could not verify subscription",
        });
    }
}

export async function getBillingDetails(req, res) {
    try {
        const userId = req.user._id;
        const effectivePlan = getEffectivePlan(req.user);
        const entitlements = getPlanEntitlements(effectivePlan);
        const usage = await getOrCreateUserUsage(userId);

        // Read only from local MongoDB
        const subscription = await Subscription.findOne({
            user: userId,
            status: { $in: ["authenticated", "active", "pending", "paused"] },
        }).sort({ createdAt: -1 });

        if (!subscription) {
            return res.status(200).json({
                success: true,
                billing: {
                    plan: "free",
                    effectivePlan: "free",
                    planName: "Free",
                    status: "none",
                    currentStart: null,
                    currentEnd: null,
                    cancelAtCycleEnd: false,
                    entitlements,
                    usage,
                },
            });
        }

        const plan = await Plan.findOne({ key: subscription.planKey });

        return res.status(200).json({
            success: true,
            billing: {
                plan: subscription.planKey,
                effectivePlan,
                planName: plan?.name || "ChaiLM Pro",
                amount: plan?.amount || 19900,
                period: plan?.period || "monthly",
                status: subscription.status,
                currentStart: subscription.currentStart,
                currentEnd: subscription.currentEnd,
                cancelAtCycleEnd: subscription.cancelAtCycleEnd,
                entitlements,
                usage,
            },
        });
    } catch (err) {
        console.error("getBillingDetails failed:", err);
        return res.status(500).json({
            success: false,
            message: "Could not fetch billing details",
        });
    }
}

export async function cancelSubscription(req, res) {
    try {
        const userId = req.user._id;

        const subscription = await Subscription.findOne({
            user: userId,
            status: { $in: ["authenticated", "active", "pending", "paused"] },
        }).sort({ createdAt: -1 });

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: "No active subscription found to cancel",
            });
        }

        // Cancel at the end of the billing cycle in Razorpay
        await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, true);

        // Fetch authoritative updated subscription from Razorpay
        const remoteSub = await razorpay.subscriptions.fetch(subscription.razorpaySubscriptionId);

        // Explicitly mark cycle end cancellation on our subscription model
        subscription.cancelAtCycleEnd = true;
        if (remoteSub?.status) subscription.status = remoteSub.status;
        if (remoteSub?.current_end) {
            subscription.currentEnd = new Date(remoteSub.current_end * 1000);
        }
        await subscription.save();

        // Sync user document
        await applyRazorpaySubscriptionToDb(remoteSub, userId);
        
        // Re-ensure cancelAtCycleEnd remains true
        subscription.cancelAtCycleEnd = true;
        await subscription.save();

        return res.status(200).json({
            success: true,
            message: "Subscription will cancel at the end of the current billing cycle",
            billing: {
                plan: subscription.planKey,
                status: subscription.status,
                currentEnd: subscription.currentEnd,
                cancelAtCycleEnd: true,
            },
        });
    } catch (err) {
        console.error("cancelSubscription failed:", {
            userId: String(req.user?._id),
            statusCode: err?.statusCode,
            message: err?.error?.description ?? err?.message,
        });
        return res.status(500).json({
            success: false,
            message: err?.error?.description || "Could not cancel subscription",
        });
    }
}