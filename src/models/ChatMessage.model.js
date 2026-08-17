import mongoose from "mongoose";

const CitationSchema = new mongoose.Schema({
  sourceId: { type: String, default: null },
  sourceType: { 
    type: String, 
    enum: ["youtube", "pdf", "website", "unknown"],
    default: "unknown"
  },
  pageNumber: { type: Number, default: null },
  startSeconds: { type: Number, default: null },
  formattedTimestamp: { type: String, default: null },
  timeUrl: { type: String, default: null },
});

const AnswerSegmentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  citation: { type: CitationSchema, default: null },
});

const AnswerSectionSchema = new mongoose.Schema({
  sectionTitle: { type: String, required: true },
  sourceId: { type: String, default: null },
  summary: { type: String, default: "" },
  segments: [AnswerSegmentSchema],
});

const AnswerSchema = new mongoose.Schema({
  overallSummary: { type: String, required: true },
  sections: [AnswerSectionSchema],
  summary: { type: String, default: null },
  segments: { type: [AnswerSegmentSchema], default: [] },
});

const ChatMessageSchema = new mongoose.Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    query: { type: String, default: null }, // Filled if role === 'user'
    answer: { type: AnswerSchema, default: null }, // Filled if role === 'assistant'
    sources: { type: Array, default: [] }, // Retrieved grounding sources
  },
  { timestamps: true }
);

// Compound index for high-performance chronological queries
ChatMessageSchema.index({ workspaceId: 1, userId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
