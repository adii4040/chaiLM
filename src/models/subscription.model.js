import mongoose from "mongoose";

export const LIVE_STATUSES = ["created", "authenticated", "active", "pending", "paused"];

const subscriptionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        planKey: { type: String, required: true },
        razorpayPlanId: { type: String, required: true },
        razorpaySubscriptionId: { type: String, required: true, unique: true },
        status: {
            type: String,
            enum: ["created", "authenticated", "active", "pending", "halted", "cancelled", "completed", "expired", "paused"],
            default: "created",
        },
        totalCount: { type: Number, required: true },
        currentStart: { type: Date },
        currentEnd: { type: Date },
        cancelAtCycleEnd: { type: Boolean, default: false },
    },
    { timestamps: true }
);

subscriptionSchema.index({ user: 1, createdAt: -1 });

subscriptionSchema.index(
    { user: 1 },
    {
        name: "one_live_subscription_per_user",
        unique: true,
        partialFilterExpression: { status: { $in: LIVE_STATUSES } },
    }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);