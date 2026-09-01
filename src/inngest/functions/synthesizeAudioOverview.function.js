import { inngest } from "../client.js";
import { StudioArtifact } from "../../models/StudioArtifact.model.js";
import { synthesizeDialogueAudio } from "../../services/ai/artifact/synthesizeDialogueAudio.service.js";

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

    // Step 3: Synthesize dialogue audio with TTS
    const audioResults = await step.run("synthesize-dialogue-tts", async () => {
      try {
        const dialogue = artifact.data?.dialogue || [];
        if (!dialogue.length) {
          throw new Error("Artifact contains no dialogue turns to synthesize");
        }

        const buffers = await synthesizeDialogueAudio(dialogue);
        return { bufferCount: buffers.length };
      } catch (error) {
        console.error(`[Inngest TTS Synthesis Error] Failed for artifact ${artifactId}:`, error.message);
        await StudioArtifact.findOneAndUpdate(
          { $or: [{ _id: artifactId }, { artifactId }] },
          { audioStatus: "failed", audioError: error.message }
        );
        throw error;
      }
    });

    // Step 4: TODO — this is a placeholder for now, do not implement: FFmpeg stitching of the returned buffers into one file, upload to Cloudinary, and setting audioUrl + audioStatus: 'ready'
    await step.run("stitch-and-upload-audio", async () => {
      console.log(
        `[Inngest Studio Audio] Synthesized ${audioResults.bufferCount} audio buffers for artifact ${artifactId}. (Stitching & Cloudinary upload step pending implementation)`
      );

      return await StudioArtifact.findOneAndUpdate(
        { $or: [{ _id: artifactId }, { artifactId }] },
        { audioStatus: "ready" },
        { new: true }
      );
    });

    return {
      success: true,
      artifactId,
      bufferCount: audioResults.bufferCount,
      audioStatus: "ready",
    };
  }
);
