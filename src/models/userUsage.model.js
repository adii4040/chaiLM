import mongoose, { Schema } from "mongoose";

const userUsageSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cycleKey: {
      type: String,
      required: true,
      index: true,
    },
    cycleStart: {
      type: Date,
      required: true,
    },
    cycleEnd: {
      type: Date,
      required: true,
    },
    dailyQueries: {
      date: {
        type: String, // Format: YYYY-MM-DD
        default: () => new Date().toISOString().slice(0, 10),
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    monthlyQueries: {
      type: Number,
      default: 0,
    },
    studyGuides: {
      type: Number,
      default: 0,
    },
    flashcards: {
      type: Number,
      default: 0,
    },
    quizzes: {
      type: Number,
      default: 0,
    },
    mindmaps: {
      type: Number,
      default: 0,
    },
    audioOverviews: {
      type: Number,
      default: 0,
    },
    webScrapes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index so one usage document exists per user per billing cycle
userUsageSchema.index({ userId: 1, cycleKey: 1 }, { unique: true });

export const UserUsage = mongoose.model("UserUsage", userUsageSchema);
