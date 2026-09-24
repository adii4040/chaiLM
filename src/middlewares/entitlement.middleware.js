import { getEffectivePlan } from "../services/subscription.service.js";
import { getPlanEntitlements } from "../config/planConfig.js";
import { getOrCreateUserUsage } from "../services/usage.service.js";
import { Workspace } from "../models/Workspace.model.js";

/**
 * Ensures effective plan, entitlements, and active usage record are attached to req.
 * Safe to call multiple times (caches result on req).
 *
 * @param {import("express").Request} req
 */
export async function ensureEffectivePlanAttached(req) {
  if (!req.effectivePlan) {
    req.effectivePlan = getEffectivePlan(req.user);
    req.entitlements = getPlanEntitlements(req.effectivePlan);
  }
  if (req.user?._id && !req.userUsage) {
    req.userUsage = await getOrCreateUserUsage(req.user._id);
  }
}

/**
 * Middleware that computes and attaches req.effectivePlan, req.entitlements, and req.userUsage.
 */
export async function attachEffectivePlan(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to evaluate plan entitlements",
      });
    }

    await ensureEffectivePlanAttached(req);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard Middleware: Requires user to be on one of the specified plan tiers.
 *
 * @param {string[]} [allowedPlans=["standard_monthly", "pro_monthly"]]
 */
export function requirePlan(allowedPlans = ["standard_monthly", "pro_monthly"]) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      await ensureEffectivePlanAttached(req);

      if (!allowedPlans.includes(req.effectivePlan)) {
        return res.status(403).json({
          success: false,
          code: "UPGRADE_REQUIRED",
          message: "This feature requires an active paid subscription.",
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
 * Guard Middleware: Checks total workspace count limit.
 */
export async function checkWorkspaceLimit(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    await ensureEffectivePlanAttached(req);

    const maxWorkspaces = req.entitlements.maxWorkspaces;
    const currentCount = await Workspace.countDocuments({
      userId: req.user._id,
      isSample: { $ne: true },
    });

    if (currentCount >= maxWorkspaces) {
      return res.status(403).json({
        success: false,
        code: "WORKSPACE_LIMIT_REACHED",
        message: `You have reached the maximum allowed workspaces (${maxWorkspaces}) for your ${req.entitlements.name} plan. Upgrade to create more workspaces.`,
        currentCount,
        maxAllowed: maxWorkspaces,
        currentPlan: req.effectivePlan,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard Middleware: Checks documents per workspace limit and web scraping limits.
 */
export async function checkDocumentAndScrapingLimit(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    await ensureEffectivePlanAttached(req);

    const { workspaceId, type } = req.body;
    if (!workspaceId) {
      return next(); // Let controller handle missing workspaceId validation
    }

    const workspace = await Workspace.findOne({ workspaceId: workspaceId.trim() });
    if (!workspace) {
      return next(); // Let controller return 404
    }

    // Exemption for sample workspace
    if (workspace.isSample) {
      return next();
    }

    // 1. Check Document count limit in this workspace
    const maxDocs = req.entitlements.maxDocumentsPerWorkspace;
    const currentDocs = workspace.sources ? workspace.sources.length : 0;

    if (currentDocs >= maxDocs) {
      return res.status(403).json({
        success: false,
        code: "DOCUMENTS_PER_WORKSPACE_LIMIT_REACHED",
        message: `This workspace has reached its document limit of ${maxDocs} sources on your ${req.entitlements.name} plan.`,
        currentDocs,
        maxAllowed: maxDocs,
        currentPlan: req.effectivePlan,
      });
    }

    // 2. If indexing a Website, check Web Scraping monthly allowance
    const normalizedType = type ? String(type).trim().toLowerCase() : "";
    if (normalizedType === "website") {
      const maxScrapes = req.entitlements.webScrapesPerMonth;
      const currentScrapes = req.userUsage?.webScrapes || 0;

      if (currentScrapes >= maxScrapes) {
        return res.status(403).json({
          success: false,
          code: "WEB_SCRAPING_LIMIT_REACHED",
          message: `You have reached your monthly Web Scraping limit of ${maxScrapes} URLs on your ${req.entitlements.name} plan.`,
          currentScrapes,
          maxAllowed: maxScrapes,
          currentPlan: req.effectivePlan,
        });
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard Middleware: Checks AI Query daily burst limit and monthly quota.
 */
export async function checkQueryLimit(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    await ensureEffectivePlanAttached(req);

    const { workspaceId } = req.body;
    if (workspaceId) {
      const workspace = await Workspace.findOne({ workspaceId: workspaceId.trim() });
      if (workspace?.isSample) {
        return next(); // Sample workspace is quota-free
      }
    }

    const dailyLimit = req.entitlements.aiQueriesPerDay;
    const monthlyLimit = req.entitlements.aiQueriesPerMonth;
    const currentDaily = req.userUsage?.dailyQueries?.count || 0;
    const currentMonthly = req.userUsage?.monthlyQueries || 0;

    // Check daily burst limit
    if (currentDaily >= dailyLimit) {
      return res.status(429).json({
        success: false,
        code: "DAILY_QUERY_LIMIT_REACHED",
        message: `Daily query limit reached (${dailyLimit}/day). Your daily query allowance will reset tomorrow.`,
        currentDaily,
        dailyLimit,
        currentPlan: req.effectivePlan,
      });
    }

    // Check monthly total limit
    if (currentMonthly >= monthlyLimit) {
      return res.status(403).json({
        success: false,
        code: "MONTHLY_QUERY_LIMIT_REACHED",
        message: `Monthly query limit reached (${monthlyLimit}/mo) on your ${req.entitlements.name} plan. Upgrade to continue querying.`,
        currentMonthly,
        monthlyLimit,
        currentPlan: req.effectivePlan,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard Middleware: Checks Studio Artifact generation entitlement limits.
 *
 * @param {"study_guide"|"flashcards"|"quiz"|"mindmap"|"audio_overview"} artifactType
 */
export function checkStudioArtifactLimit(artifactType) {
  const configMap = {
    study_guide: { limitKey: "studyGuidesPerMonth", usageKey: "studyGuides", name: "Study Guide" },
    flashcards: { limitKey: "flashcardsPerMonth", usageKey: "flashcards", name: "Flashcards" },
    quiz: { limitKey: "quizzesPerMonth", usageKey: "quizzes", name: "Quiz" },
    mindmap: { limitKey: "mindmapsPerMonth", usageKey: "mindmaps", name: "Mind Map" },
    audio_overview: { limitKey: "audioOverviewsPerMonth", usageKey: "audioOverviews", name: "Audio Overview" },
  };

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      await ensureEffectivePlanAttached(req);

      const { workspaceId } = req.body;
      if (workspaceId) {
        const workspace = await Workspace.findOne({ workspaceId: workspaceId.trim() });
        if (workspace?.isSample) {
          return next(); // Sample workspace is quota-free
        }
      }

      const conf = configMap[artifactType];
      if (!conf) return next();

      const maxAllowed = req.entitlements[conf.limitKey] ?? 0;
      const currentUsage = req.userUsage?.[conf.usageKey] || 0;

      // 1. If feature is completely locked on this plan (e.g. Free tier Quiz, Mindmap, Audio Overview)
      if (maxAllowed === 0) {
        return res.status(403).json({
          success: false,
          code: "UPGRADE_REQUIRED",
          message: `${conf.name} is a premium feature. Upgrade to Standard or Pro to unlock live generation.`,
          feature: artifactType,
          currentPlan: req.effectivePlan,
        });
      }

      // 2. If feature limit is reached
      if (currentUsage >= maxAllowed) {
        return res.status(403).json({
          success: false,
          code: "ARTIFACT_LIMIT_REACHED",
          message: `You have reached your monthly limit for ${conf.name} (${maxAllowed}/mo) on your ${req.entitlements.name} plan.`,
          feature: artifactType,
          currentUsage,
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
