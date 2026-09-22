/**
 * Default Entitlements Configuration
 * 
 * Provides fallback and initial entitlement definitions for plans.
 * These dummy values can be customized or overridden in the MongoDB Plan collection.
 */

export const DEFAULT_PLAN_ENTITLEMENTS = {
  free: {
    maxWorkspaces: 2,
    canUseDummyProFeature: false,
    audioOverviewAllowed: false,
    aiQueriesPerDay: 15,
  },
  pro_monthly: {
    maxWorkspaces: 50,
    canUseDummyProFeature: true,
    audioOverviewAllowed: true,
    aiQueriesPerDay: 500,
  },
};

/**
 * Resolves entitlements for a specific plan key.
 * Falls back to "free" entitlements if the plan is unknown or not configured.
 * 
 * @param {string} planKey - e.g. "free", "pro_monthly"
 * @returns {Record<string, any>} Entitlements object
 */
export function getPlanEntitlements(planKey) {
  if (!planKey || !DEFAULT_PLAN_ENTITLEMENTS[planKey]) {
    return { ...DEFAULT_PLAN_ENTITLEMENTS.free };
  }
  return { ...DEFAULT_PLAN_ENTITLEMENTS[planKey] };
}
