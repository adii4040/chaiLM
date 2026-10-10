import mongoose from "mongoose";
import { UserUsage } from "../models/userUsage.model.js";
import { Subscription } from "../models/subscription.model.js";

/**
 * Calculates current cycle dates and key for a user.
 */
export async function getActiveCycleInfo(userId, userDoc = null) {
  const now = new Date();

  // 1. Check if user has an active paid subscription
  const liveSub = await Subscription.findOne({
    user: userId,
    status: { $in: ["authenticated", "active", "pending", "paused"] },
  }).sort({ createdAt: -1 });

  if (liveSub && liveSub.currentStart && liveSub.currentEnd) {
    const cycleStart = new Date(liveSub.currentStart);
    const cycleEnd = new Date(liveSub.currentEnd);

    // If current date falls within sub cycle
    if (now >= cycleStart && now <= cycleEnd) {
      const cycleKey = `sub_${liveSub._id}_${cycleStart.getTime()}`;
      return { cycleKey, cycleStart, cycleEnd };
    }
  }

  // 2. Default: Calendar month cycle (for Free tier or fallback)
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const cycleStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const cycleEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const monthStr = String(month + 1).padStart(2, "0");
  const cycleKey = `cal_${year}-${monthStr}`;

  return { cycleKey, cycleStart, cycleEnd };
}

/**
 * Retrieves or initializes the UserUsage document for the current cycle.
 * Automatically resets dailyQueries count if the date has changed.
 */
export async function getOrCreateUserUsage(userId) {
  if (!userId) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const { cycleKey, cycleStart, cycleEnd } = await getActiveCycleInfo(userId);

  let usage = await UserUsage.findOne({ userId, cycleKey });

  if (!usage) {
    try {
      usage = await UserUsage.create({
        userId,
        cycleKey,
        cycleStart,
        cycleEnd,
        dailyQueries: {
          date: todayStr,
          count: 0,
        },
      });
    } catch (err) {
      // Handle race conditions where another request created the doc in parallel
      if (err.code === 11000) {
        usage = await UserUsage.findOne({ userId, cycleKey });
      } else {
        throw err;
      }
    }
  }

  // If daily counter belongs to a previous date, reset it
  if (usage.dailyQueries.date !== todayStr) {
    usage = await UserUsage.findOneAndUpdate(
      { _id: usage._id },
      {
        $set: {
          "dailyQueries.date": todayStr,
          "dailyQueries.count": 0,
        },
      },
      { new: true }
    );
  }

  return usage;
}

/**
 * Atomically increments usage count for a given feature.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {"studyGuides"|"flashcards"|"quizzes"|"mindmaps"|"audioOverviews"|"webScrapes"|"queries"} featureType
 * @param {number} [amount=1]
 */
export async function incrementUserUsage(userId, featureType, amount = 1) {
  if (!userId) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const { cycleKey, cycleStart, cycleEnd } = await getActiveCycleInfo(userId);

  // First ensure document exists and daily date is updated
  await getOrCreateUserUsage(userId);

  if (featureType === "queries") {
    // Increment both dailyQueries.count and monthlyQueries
    const updated = await UserUsage.findOneAndUpdate(
      { userId, cycleKey },
      {
        $inc: {
          "dailyQueries.count": amount,
          monthlyQueries: amount,
        },
      },
      { new: true }
    );
    return updated;
  }

  // Generic feature increment
  const updateQuery = {
    $inc: { [featureType]: amount },
  };

  const updated = await UserUsage.findOneAndUpdate(
    { userId, cycleKey },
    updateQuery,
    { new: true }
  );

  return updated;
}
