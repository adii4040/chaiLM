import { Plan } from "../models/plan.model.js";

export async function getPlans(req, res) {
  try {
    const plans = await Plan.find({ isActive: true })
      .select("key name description amount currency period interval entitlements -_id")
      .sort({ amount: 1 });

    return res.status(200).json({
      success: true,
      plans,
      message: "Plans fetched successfully",
    });
  } catch (error) {
    console.error("Error in getPlans:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch plans",
    });
  }
}