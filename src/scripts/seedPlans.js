import "dotenv/config";
import mongoose from "mongoose";
import { Plan } from "../models/plan.model.js";
import { createRazorpayPlan } from "../services/razorpayPlan.service.js";
import { DEFAULT_PLAN_ENTITLEMENTS } from "../config/planConfig.js";

const PLANS = [
  {
    key: "standard_monthly",
    name: "ChaiLM Standard",
    description: "ChaiLM Standard monthly subscription (₹99/mo)",
    amount: 9900, // paise = ₹99
    period: "monthly",
    interval: 1,
    entitlements: DEFAULT_PLAN_ENTITLEMENTS.standard_monthly,
    isActive: true,
  },
  {
    key: "pro_monthly",
    name: "ChaiLM Pro",
    description: "ChaiLM Pro monthly subscription (₹199/mo)",
    amount: 19900, // paise = ₹199
    period: "monthly",
    interval: 1,
    entitlements: DEFAULT_PLAN_ENTITLEMENTS.pro_monthly,
    isActive: true,
  },
];

import { razorpay } from "../lib/razorpay.js";

async function seedPlan(p) {
  const existing = await Plan.findOne({ key: p.key });
  const isForce = process.argv.includes("--force") || process.argv.includes("--live");

  let needsFreshRazorpayPlan = isForce || !existing || !existing.razorpayPlanId;

  if (existing && existing.razorpayPlanId && !isForce) {
    try {
      // Check if plan exists in current Razorpay account (Live vs Test)
      await razorpay.plans.fetch(existing.razorpayPlanId);
    } catch (fetchErr) {
      console.log(`Plan ${existing.razorpayPlanId} not found in current Razorpay account. Creating new Live plan...`);
      needsFreshRazorpayPlan = true;
    }
  }

  if (needsFreshRazorpayPlan) {
    const rzpPlan = await createRazorpayPlan(p);
    if (existing) {
      await Plan.updateOne(
        { key: p.key },
        {
          $set: {
            name: p.name,
            description: p.description,
            amount: p.amount,
            period: p.period,
            interval: p.interval,
            razorpayPlanId: rzpPlan.id,
            entitlements: p.entitlements ?? {},
            isActive: p.isActive ?? true,
          },
        }
      );
      console.log(`✅ Re-created & synced ${p.key} in Razorpay -> ${rzpPlan.id}`);
    } else {
      await Plan.create({ ...p, razorpayPlanId: rzpPlan.id });
      console.log(`✅ Created fresh ${p.key} in Razorpay -> ${rzpPlan.id}`);
    }
    return;
  }

  // Update fields that live in DB
  await Plan.updateOne(
    { key: p.key },
    {
      $set: {
        name: p.name,
        description: p.description,
        entitlements: p.entitlements ?? {},
        isActive: p.isActive ?? true,
      },
    }
  );
  console.log(`✅ Updated existing ${p.key} metadata (Razorpay Plan ID: ${existing.razorpayPlanId})`);
}

async function main() {
  let failed = false;
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    for (const p of PLANS) {
      try {
        await seedPlan(p);
      } catch (err) {
        failed = true;
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