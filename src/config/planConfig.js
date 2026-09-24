/**
 * Final Entitlements & Pricing Configuration (v2)
 *
 * Tier definitions:
 * - Free (₹0)
 * - Standard (₹99 / mo -> 9900 paise)
 * - Pro (₹199 / mo -> 19900 paise)
 */

export const DEFAULT_PLAN_ENTITLEMENTS = {
  free: {
    key: "free",
    name: "Free",
    price: 0,
    currency: "INR",
    maxWorkspaces: 3,
    maxDocumentsPerWorkspace: 3,
    maxFileSizeMb: 6,
    aiQueriesPerDay: 30,
    aiQueriesPerMonth: 500,
    studyGuidesPerMonth: 8,
    flashcardsPerMonth: 8,
    quizzesPerMonth: 0,
    mindmapsPerMonth: 0,
    audioOverviewsPerMonth: 0,
    webScrapesPerMonth: 3,
    support: "Community",
  },
  standard_monthly: {
    key: "standard_monthly",
    name: "Standard",
    price: 99,
    razorpayAmountPaise: 9900,
    currency: "INR",
    maxWorkspaces: 10,
    maxDocumentsPerWorkspace: 8,
    maxFileSizeMb: 6,
    aiQueriesPerDay: 150,
    aiQueriesPerMonth: 1200,
    studyGuidesPerMonth: 25,
    flashcardsPerMonth: 25,
    quizzesPerMonth: 25,
    mindmapsPerMonth: 25,
    audioOverviewsPerMonth: 4,
    webScrapesPerMonth: 15,
    support: "Email",
  },
  pro_monthly: {
    key: "pro_monthly",
    name: "Pro",
    price: 199,
    razorpayAmountPaise: 19900,
    currency: "INR",
    maxWorkspaces: 22,
    maxDocumentsPerWorkspace: 20,
    maxFileSizeMb: 6,
    aiQueriesPerDay: 200,
    aiQueriesPerMonth: 1600,
    studyGuidesPerMonth: 60,
    flashcardsPerMonth: 60,
    quizzesPerMonth: 60,
    mindmapsPerMonth: 60,
    audioOverviewsPerMonth: 10,
    webScrapesPerMonth: 25,
    support: "Priority",
  },
};

/**
 * Resolves entitlements for a specific plan key.
 * Falls back to "free" entitlements if the plan is unknown or not configured.
 *
 * @param {string} planKey - e.g. "free", "standard_monthly", "pro_monthly"
 * @returns {Record<string, any>} Entitlements object
 */
export function getPlanEntitlements(planKey) {
  if (!planKey || !DEFAULT_PLAN_ENTITLEMENTS[planKey]) {
    return { ...DEFAULT_PLAN_ENTITLEMENTS.free };
  }
  return { ...DEFAULT_PLAN_ENTITLEMENTS[planKey] };
}
