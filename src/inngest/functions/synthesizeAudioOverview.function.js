import { inngest } from "../client.js";
import { StudioArtifact } from "../../models/StudioArtifact.model.js";
import { synthesizeDialogueAudio } from "../../services/ai/artifact/synthesizeDialogueAudio.service.js";
import { stitchDialogueAudio } from "../../services/ai/artifact/audioStitcher.service.js";
import { uploadOnCloudinary } from "../../lib/cloudinary.lib.js";

/**
 * Inngest background job function for Studio Audio Overview TTS synthesis.
 * Listens for event: 'studio/audio.synthesize.requested'
 */
export const synthesizeAudioOverviewFunction = inngest.createFunction(
  {
    id: "synthesize-audio-overview-pipeline",
    name: "Synthesize Studio Audio Overview Pipeline",
    retries: 2,
    triggers: [{ event: "studio/audio.synthesize.requested" }],
    onFailure: async ({ event, error }) => {
      const originalData = event.data?.event?.data || event.data;
      const { artifactId } = originalData || {};
      if (artifactId) {
        console.error(`[Inngest Studio Audio Synthesis Failure] Failed for artifact ${artifactId}:`, error.message);
        await StudioArtifact.findOneAndUpdate(
          { $or: [{ _id: artifactId }, { artifactId }] },
          { audioStatus: "failed", audioError: error.message }
        );
      }
    },
  },
  async ({ event, step }) => {
    const { artifactId } = event.data;

    if (!artifactId) {
      throw new Error("Missing required artifactId in event data");
    }

    // Step 1: Fetch the StudioArtifact document by artifactId
    const artifact = await step.run("fetch-studio-artifact", async () => {
      const doc = await StudioArtifact.findOne({
        $or: [{ _id: artifactId }, { artifactId }],
      });

      if (!doc) {
        throw new Error(`StudioArtifact with ID "${artifactId}" not found`);
      }

      if (doc.type !== "audio_overview") {
        throw new Error(`Artifact "${artifactId}" has invalid type "${doc.type}" (expected "audio_overview")`);
      }

      return doc;
    });

    // Step 2: Set audioStatus: 'processing' and save
    await step.run("mark-audio-processing", async () => {
      return await StudioArtifact.findOneAndUpdate(
        { $or: [{ _id: artifactId }, { artifactId }] },
        { audioStatus: "processing", audioError: null },
        { new: true }
      );
    });

    // Step 3: Synthesize dialogue TTS, stitch with seamless mute via FFmpeg, and upload to Cloudinary (all in one step to avoid serializing Buffer payloads into step state)
    const audioResults = await step.run("synthesize-and-process-audio", async () => {
      const dialogue = artifact.data?.dialogue || [];
      if (!dialogue.length) {
        throw new Error("Artifact contains no dialogue turns to synthesize");
      }

      console.log(`[Inngest Studio Audio] Synthesizing ${dialogue.length} dialogue turns for artifact ${artifactId}...`);
      const turnResults = await synthesizeDialogueAudio(dialogue);

      console.log(`[Inngest Studio Audio] Stitching ${turnResults.length} audio buffers with seamless mute...`);
      const { outputPath, cleanup } = await stitchDialogueAudio(turnResults, {
        pauseDurationMs: 400,
      });

      let uploadResponse = null;
      try {
        console.log(`[Inngest Studio Audio] Uploading stitched overview to Cloudinary for artifact ${artifactId}...`);
        uploadResponse = await uploadOnCloudinary(outputPath);
        if (!uploadResponse || !uploadResponse.secure_url) {
          throw new Error("Cloudinary upload failed for stitched audio overview");
        }
      } finally {
        await cleanup();
      }

      const audioUrl = uploadResponse.secure_url;
      const duration = uploadResponse.duration || null;

      console.log(`[Inngest Studio Audio] Audio synthesis and upload completed for artifact ${artifactId}: ${audioUrl}`);

      await StudioArtifact.findOneAndUpdate(
        { $or: [{ _id: artifactId }, { artifactId }] },
        {
          audioStatus: "ready",
          audioUrl,
          ...(duration ? { "metadata.durationSeconds": duration } : {}),
        },
        { new: true }
      );

      return {
        audioUrl,
        duration,
        bufferCount: turnResults.length,
        audioStatus: "ready",
      };
    });

    return {
      success: true,
      artifactId,
      audioUrl: audioResults.audioUrl,
      duration: audioResults.duration,
      bufferCount: audioResults.bufferCount,
      audioStatus: "ready",
    };
  }
);
