import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import fs from "fs/promises";
import os from "os";
import path from "path";

// Configure fluent-ffmpeg with bundled static binaries
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Module-level in-memory cache for generated silence MP3 buffers.
 * Keyed by: `${sampleRate}-${channels}-${durationSec}`
 */
const silenceBufferCache = new Map();

/**
 * Probes an audio file to extract sample rate and channel layout.
 *
 * @param {string} filePath - Path to audio file.
 * @returns {Promise<{sampleRate: number, channels: number, duration: number}>}
 */
export function probeAudio(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const audioStream =
        metadata?.streams?.find((s) => s.codec_type === "audio") ||
        metadata?.streams?.[0];

      if (!audioStream) {
        return reject(new Error(`No audio stream found in ${filePath}`));
      }

      resolve({
        sampleRate: parseInt(audioStream.sample_rate, 10) || 24000,
        channels: parseInt(audioStream.channels, 10) || 1,
        duration: parseFloat(audioStream.duration) || 0,
      });
    });
  });
}

/**
 * Generates a pure silence MP3 buffer matching the given sample rate and channel count.
 *
 * @param {number} sampleRate - Audio sample rate (e.g., 24000, 44100).
 * @param {number} channels - Number of channels (1 for mono, 2 for stereo).
 * @param {number} durationSec - Duration of silence in seconds.
 * @returns {Promise<Buffer>}
 */
export async function generateSilenceBuffer(sampleRate, channels, durationSec) {
  const tempSilencePath = path.join(
    os.tmpdir(),
    `temp_silence_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
  );
  const channelLayout = channels === 1 ? "mono" : "stereo";

  try {
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(`anullsrc=r=${sampleRate}:cl=${channelLayout}`)
        .inputFormat("lavfi")
        .duration(durationSec)
        .audioCodec("libmp3lame")
        .audioChannels(channels)
        .save(tempSilencePath)
        .on("end", resolve)
        .on("error", reject);
    });

    return await fs.readFile(tempSilencePath);
  } finally {
    await fs.unlink(tempSilencePath).catch(() => {});
  }
}

/**
 * Gets or generates a cached silence MP3 buffer for the requested audio specs.
 *
 * @param {number} sampleRate
 * @param {number} channels
 * @param {number} [durationSec=0.4]
 * @returns {Promise<Buffer>}
 */
export async function getSilenceBuffer(sampleRate, channels, durationSec = 0.4) {
  const cacheKey = `${sampleRate}-${channels}-${durationSec}`;
  if (silenceBufferCache.has(cacheKey)) {
    return silenceBufferCache.get(cacheKey);
  }

  const silenceBuffer = await generateSilenceBuffer(sampleRate, channels, durationSec);
  silenceBufferCache.set(cacheKey, silenceBuffer);
  return silenceBuffer;
}

/**
 * Stitches ordered dialogue audio buffers into a single MP3 with silence in between.
 * Uses FFmpeg Concat Demuxer with Stream Copy (-c copy) for instantaneous execution.
 *
 * @param {Array<{speaker: string, buffer: Buffer}>} turnResults - Array of speech turn buffers in order.
 * @param {Object} [options]
 * @param {number} [options.pauseDurationMs=400] - Inter-turn silence duration in milliseconds.
 * @returns {Promise<{outputPath: string, cleanup: () => Promise<void>}>}
 */
export async function stitchDialogueAudio(turnResults, options = {}) {
  if (!turnResults || !turnResults.length) {
    throw new Error("No audio turns provided to stitch");
  }

  const pauseDurationMs = options.pauseDurationMs ?? 400;
  const pauseDurationSec = pauseDurationMs / 1000;

  // 1. Create a unique temporary workspace directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "chailm-stitch-"));

  const cleanup = async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[AudioStitcher] Failed to cleanup temp dir ${tempDir}:`, err.message);
    }
  };

  try {
    // 2. Write all dialogue turn buffers to temporary MP3 files
    const turnFilePaths = [];
    for (let i = 0; i < turnResults.length; i++) {
      const filePath = path.join(tempDir, `turn_${i}.mp3`);
      await fs.writeFile(filePath, turnResults[i].buffer);
      turnFilePaths.push(filePath);
    }

    // 3. Probe the first turn file once to detect exact sample rate & channels
    const metadata = await probeAudio(turnFilePaths[0]);
    const { sampleRate, channels } = metadata;

    // 4. Get matching cached silence buffer and write silence.mp3 to temp dir
    const silenceBuffer = await getSilenceBuffer(sampleRate, channels, pauseDurationSec);
    const silenceFilePath = path.join(tempDir, "silence.mp3");
    await fs.writeFile(silenceFilePath, silenceBuffer);

    // 5. Build concat manifest file interleaving dialogue turns with silence
    const manifestPath = path.join(tempDir, "concat.txt");
    const manifestLines = [];

    for (let i = 0; i < turnFilePaths.length; i++) {
      manifestLines.push(`file '${turnFilePaths[i]}'`);
      if (i < turnFilePaths.length - 1 && pauseDurationMs > 0) {
        manifestLines.push(`file '${silenceFilePath}'`);
      }
    }

    await fs.writeFile(manifestPath, manifestLines.join("\n"), "utf-8");

    // 6. Run FFmpeg stream-copy concat demuxer
    const outputFilePath = path.join(tempDir, "final_overview.mp3");

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(manifestPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .save(outputFilePath)
        .on("end", resolve)
        .on("error", (err) => {
          console.error("[AudioStitcher] FFmpeg concat error:", err.message);
          reject(err);
        });
    });

    return {
      outputPath: outputFilePath,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
