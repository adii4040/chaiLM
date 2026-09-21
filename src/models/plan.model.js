import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true, unique: true
        }, // your internal id, e.g. "pro_monthly"
        name: {
            type: String,
            required: true
        },
        description: {
            type: String
        },
        amount: {
            type: Number,
            required: true
        }, // in paise: 49900 = ₹499
        currency: {
            type: String,
            default: "INR"
        },
        period: {
            type: String,
            enum: ["daily", "weekly", "monthly", "yearly"],
            required: true
        },
        interval: {
            type: Number,
            default: 1
        }, // quarterly = period "monthly" + interval 3
        razorpayPlanId: {
            type: String,
            required: true, unique: true
        },
        entitlements: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }, // your own limits, filled in later
        isActive: {
            type: Boolean,
            default: true
        },
    },
    { timestamps: true }
);

export const Plan = mongoose.model("Plan", planSchema);