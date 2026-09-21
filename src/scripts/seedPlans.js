import "dotenv/config";
import mongoose from "mongoose";
import { Plan } from "../models/plan.model.js";
import { createRazorpayPlan } from "../services/razorpayPlan.service.js";

const PLANS = [
    {
        key: "pro_monthly",
        name: "ChaiLM Pro",
        description: "ChaiLM Pro monthly subscription",
        amount: 49900, // paise = ₹499, change to your real price
        period: "monthly",
        interval: 1,
        entitlements: {}, // your own limits, editable any time
        isActive: true,
    },
];

// Razorpay locks these after creation. Changing them needs a NEW plan (new key).
const LOCKED_FIELDS = ["amount", "period", "interval"];

async function seedPlan(p) {
    const existing = await Plan.findOne({ key: p.key });

    if (existing) {
        const changed = LOCKED_FIELDS.filter((f) => existing[f] !== p[f]);
        if (changed.length) {
            console.warn(
                `⚠ ${p.key}: ${changed.join(", ")} differ from the created plan. ` +
                `Razorpay plans can't be edited, so these changes are ignored. Add a new plan with a new key instead.`
            );
        }
        // Only update fields that live in your DB
        await Plan.updateOne(
            { key: p.key },
            { $set: { entitlements: p.entitlements ?? {}, isActive: p.isActive ?? true } }
        );
        console.log(`updated ${p.key} (entitlements, isActive)`);
        return;
    }

    const rzpPlan = await createRazorpayPlan(p);
    await Plan.create({ ...p, razorpayPlanId: rzpPlan.id });
    console.log(`created ${p.key} -> ${rzpPlan.id}`);
}

async function main() {
    let failed = false;
    try {
        await mongoose.connect(process.env.MONGODB_URI); // use your app's env var name
        for (const p of PLANS) {
            try {
                await seedPlan(p);
            } catch (err) {
                failed = true;
                // As far as I know, the Razorpay SDK rejects with a plain object, not an Error
                console.error(`✗ ${p.key} failed:`, err?.error?.description ?? err?.message ?? err);
            }
        }
    } catch (err) {
        failed = true;
        console.error("Seed failed:", err?.message ?? err);
    } finally {
        await mongoose.disconnect();
        process.exit(failed ? 1 : 0);
    }
}

main();