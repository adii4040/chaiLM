import "dotenv/config";
import mongoose from "mongoose";
import { Plan } from "../models/plan.model.js";
import { Subscription } from "../models/subscription.model.js";
import User from "../models/user.model.js";
import { createRazorpayPlan } from "../services/razorpayPlan.service.js";
import { DEFAULT_PLAN_ENTITLEMENTS } from "../config/planConfig.js";

const TARGET_PLANS = [
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

async function seedOrRecreatePlan(p) {
  const existing = await Plan.findOne({ key: p.key });

  // If existing plan has different amount, delete from DB and re-register in Razorpay
  if (existing && existing.amount !== p.amount) {
    console.log(`[Plan Sync] Amount changed for ${p.key} (${existing.amount} -> ${p.amount}). Re-creating plan with Razorpay...`);
    await Plan.deleteOne({ _id: existing._id });
  }

  const updatedExisting = await Plan.findOne({ key: p.key });
  if (updatedExisting) {
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
    console.log(`✅ Updated existing plan: ${p.key} (${p.name})`);
    return;
  }

  const rzpPlan = await createRazorpayPlan(p);
  await Plan.create({ ...p, razorpayPlanId: rzpPlan.id });
  console.log(`✅ Created fresh plan in Razorpay & MongoDB: ${p.key} -> ${rzpPlan.id} (₹${p.amount / 100}/mo)`);
}

async function main() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not defined in environment.");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);

    // 1. Sync & Re-create Plans
    console.log("\n--- 1. Syncing Plans (Standard ₹99 & Pro ₹199) ---");
    for (const p of TARGET_PLANS) {
      await seedOrRecreatePlan(p);
    }

    // 2. Reset Existing Test Users to Clean Free Tier
    console.log("\n--- 2. Resetting Test User Subscriptions to Clean Free Tier ---");
    const userUpdateRes = await User.updateMany(
      {},
      {
        $set: {
          plan: "free",
          subscriptionStatus: "none",
          planExpiresAt: null,
          subscription: null,
        },
      }
    );
    console.log(`✅ Reset ${userUpdateRes.modifiedCount} user records to Free Tier`);

    // 3. Clear obsolete test subscription documents
    const subDeleteRes = await Subscription.deleteMany({});
    console.log(`✅ Cleared ${subDeleteRes.deletedCount} old test subscription documents`);

    console.log("\n🎉 Database migration and plan sync completed successfully!");
  } catch (error) {
    console.error("❌ Reset & Seed failed:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
