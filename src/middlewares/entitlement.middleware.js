import { getEffectivePlan } from "../services/subscription.service.js";
import { getPlanEntitlements } from "../config/planConfig.js";

/**
 * Ensures effective plan and entitlements are attached to the req object.
 * Safe to call multiple times (caches result on req).
 * 
 * @param {import("express").Request} req 
 */
export function ensureEffectivePlanAttached(req) {
  if (!req.effectivePlan) {
    req.effectivePlan = getEffectivePlan(req.user);
    req.entitlements = getPlanEntitlements(req.effectivePlan);
  }
}

/**
 * Middleware that computes and attaches `req.effectivePlan` and `req.entitlements`
 * to all downstream handlers. Requires `verifyJwt` to have run previously.
 */
export function attachEffectivePlan(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to evaluate plan entitlements",
      });
    }

    ensureEffectivePlanAttached(req);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard Middleware: Requires user to be on one of the specified plan tiers.
 * Automatically resolves effective plan if attachEffectivePlan was not chained.
 * 
 * @param {string[]} [allowedPlans=["pro_monthly"]] - Array of plan keys allowed access
 */
export function requirePlan(allowedPlans = ["pro_monthly"]) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      ensureEffectivePlanAttached(req);

      if (!allowedPlans.includes(req.effectivePlan)) {
        return res.status(403).json({
          success: false,
          code: "UPGRADE_REQUIRED",
          message: "This feature requires an active Pro subscription.",
          currentPlan: req.effectivePlan,
          requiredPlans: allowedPlans,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Guard Middleware: Requires a specific boolean entitlement flag to be true.
 * Automatically resolves entitlements if attachEffectivePlan was not chained.
 * 
 * @param {string} featureFlag - e.g. "canUseDummyProFeature", "audioOverviewAllowed"
 */
export function requireEntitlement(featureFlag) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      ensureEffectivePlanAttached(req);

      const hasAccess = Boolean(req.entitlements?.[featureFlag]);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          code: "FEATURE_NOT_INCLUDED",
          message: `Your current plan does not include access to "${featureFlag}".`,
          feature: featureFlag,
          currentPlan: req.effectivePlan,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Quota Guard Middleware: Checks countable limits (e.g. max workspaces, AI queries).
 * 
 * @param {string} limitKey - e.g. "maxWorkspaces", "aiQueriesPerDay"
 * @param {(req: import("express").Request) => Promise<number>|number} countResolver - Async function returning current count
 */
export function checkEntitlementLimit(limitKey, countResolver) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      ensureEffectivePlanAttached(req);

      const maxAllowed = req.entitlements?.[limitKey];

      // If no limit is configured or set to undefined, allow
      if (typeof maxAllowed !== "number") {
        return next();
      }

      const currentCount = await countResolver(req);

      if (currentCount >= maxAllowed) {
        return res.status(403).json({
          success: false,
          code: "LIMIT_REACHED",
          message: `You have reached the maximum allowed limit for ${limitKey} (${maxAllowed}) on your current plan.`,
          limitKey,
          currentCount,
          maxAllowed,
          currentPlan: req.effectivePlan,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
