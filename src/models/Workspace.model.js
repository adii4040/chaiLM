import mongoose from "mongoose";

const SourceSchema = new mongoose.Schema({
  sourceId: { type: String },
  title: { type: String, required: true },
  sourceType: { 
    type: String, 
    enum: ["youtube", "pdf", "website"], 
    required: true 
  },
  sourceUrl: { type: String, required: true },
  cloudinaryUrl: { type: String, default: null },
  videoId: { type: String, default: null },
  status: {
    type: String,
    enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
    default: "PENDING",
  },
  errorMessage: { type: String, default: null },
  indexedAt: { type: Date, default: Date.now },

  // Studio Outline State (Decoupled from Chat Q&A status)
  studioOutlineStatus: {
    type: String,
    enum: ["NOT_STARTED", "PROCESSING", "COMPLETED", "FAILED"],
    default: "NOT_STARTED",
  },
  studioOutlineError: { type: String, default: null },
  summaryOutline: {
    chapters: [
      {
        chapterIndex: { type: Number },
        chapterTitle: { type: String },
        rangeLabel: { type: String },
        rangeStart: { type: Number },
        rangeEnd: { type: Number },
        summary: { type: String },
        takeaways: [{ type: String }],
        terms: [
          {
            term: { type: String },
            definition: { type: String },
          },
        ],
      },
    ],
  },
});



SourceSchema.pre("save", function () {
  if (!this.sourceId) {
    this.sourceId = this._id.toString();
  }
});

const WorkspaceSchema = new mongoose.Schema(
  {
    workspaceId: { type: String, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, default: "Untitled Workspace" },
    sources: [SourceSchema],
  },
  { timestamps: true }
);

WorkspaceSchema.pre("save", function () {
  if (!this.workspaceId) {
    this.workspaceId = this._id.toString();
  }
});

export const Workspace = mongoose.model("Workspace", WorkspaceSchema);
