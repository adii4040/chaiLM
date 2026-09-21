import { razorpay } from "../lib/razorpay.js";

export async function createRazorpayPlan({
    key,
    name,
    description,
    amount,
    currency = "INR",
    period,
    interval = 1
}) {
    return razorpay.plans.create({
        period,
        interval,
        item: { name, description, amount, currency },
        notes: { key },
    });
}