import mongoose from "mongoose";

const StudioArtifactSchema = new mongoose.Schema(
  {
    artifactId: { type: String, unique: true, index: true },
    workspaceId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sourceId: { type: String, default: null, index: true },
    type: {
      type: String,
      enum: ["flashcards", "quiz", "mindmap", "study_guide", "audio_overview"],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

StudioArtifactSchema.pre("save", function () {
  if (!this.artifactId) {
    this.artifactId = this._id.toString();
  }
});

export const StudioArtifact = mongoose.model("StudioArtifact", StudioArtifactSchema);
