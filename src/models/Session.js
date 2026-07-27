import mongoose from "mongoose";

const SourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  sourceType: { 
    type: String, 
    enum: ["youtube", "pdf", "website"], 
    required: true 
  },
  sourceUrl: { type: String, required: true },
  cloudinaryUrl: { type: String, default: null },
  videoId: { type: String, default: null },
  indexedAt: { type: Date, default: Date.now },
});

const SessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "Untitled Workspace" },
    sources: [SourceSchema],
  },
  { timestamps: true }
);

export const Session = mongoose.model("Session", SessionSchema);
