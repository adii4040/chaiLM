import axios from "axios";
import { Document } from "@langchain/core/documents";
import { config } from "../config/env.js";
import { SourceCache } from "../models/SourceCache.model.js";

function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : url;
}

/**
 * Groups raw transcript segments into chunks based on character length,
 * not a fixed line count. Each chunk's startSeconds always comes from its
 * own first segment, so timestamps stay accurate even after grouping.
 */
function chunkTranscriptWithTimestamps(transcript, { chunkSize = 800, overlapSegments = 2 } = {}) {
  const chunks = [];
  let currentSegments = [];
  let currentLength = 0;

  for (let i = 0; i < transcript.length; i++) {
    const segment = transcript[i];
    currentSegments.push(segment);
    currentLength += segment.text.length;

    const isLast = i === transcript.length - 1;

    if (currentLength >= chunkSize || isLast) {
      chunks.push({
        text: currentSegments.map((s) => s.text).join(" "),
        startSeconds: Math.floor(currentSegments[0].start || 0),
      });

      // Carry the last few segments forward as overlap
      currentSegments = currentSegments.slice(-overlapSegments);
      currentLength = currentSegments.reduce((sum, s) => sum + s.text.length, 0);
    }
  }

  return chunks;
}

/**
 * Fetches YouTube transcript, performs timestamp-preserving chunking, and returns chunks with video metadata
 * @param {string} youtubeUrl - YouTube video URL
 * @returns {Promise<Object>} Object containing chunks, title, sourceUrl, videoId, cloudinaryUrl
 */
export async function processYouTube(youtubeUrl) {
  const videoId = extractVideoId(youtubeUrl);

  try {
    const { transcript, metadata, language } = await fetchRawYouTubeTranscript(youtubeUrl);

    console.log("[YouTube Processor] YouTube content detected. Preserving timestamp integrity during chunking...");
    const rawChunks = chunkTranscriptWithTimestamps(transcript, {
      chunkSize: config.chunking?.chunkSize || 800,
      overlapSegments: 2,
    });

    const title = metadata?.title || "YouTube Video";

    const chunks = rawChunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.text,
          metadata: {
            source: youtubeUrl,
            sourceType: "youtube",
            videoId: videoId,
            startSeconds: chunk.startSeconds,
            title: title,
            author: metadata?.author_name || "Unknown Author",
            language: language || "hi",
          },
        })
    );

    return {
      chunks,
      title,
      sourceUrl: youtubeUrl,
      videoId,
      cloudinaryUrl: null,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const apiErrorMessage = error.response?.data?.message || error.message;
      throw new Error(`Transcript API Error (${statusCode}): ${apiErrorMessage}`);
    }
    throw error;
  }
}

/**
 * Fetches raw transcript entries from DB cache or Transcript API
 * @param {string} youtubeUrl
 * @returns {Promise<{ transcript: Array, metadata: Object, videoId: string, language?: string }>}
 */
export async function fetchRawYouTubeTranscript(youtubeUrl) {
  const videoId = extractVideoId(youtubeUrl);

  // 1. Check SourceCache in MongoDB
  try {
    const cached = await SourceCache.findOne({ key: videoId, type: "youtube" });
    if (cached?.data?.transcript?.length) {
      console.log(`[SourceCache] HIT for YouTube video: ${videoId} ("${cached.title}")`);
      return {
        transcript: cached.data.transcript,
        metadata: cached.data.metadata || {},
        videoId,
        language: cached.data.language,
      };
    }
  } catch (cacheErr) {
    console.warn(`[SourceCache] Read error for YouTube video ${videoId}:`, cacheErr.message);
  }

  // 2. Fetch from external Transcript API
  try {
    console.log(`[YouTube Processor] Cache MISS. Fetching transcript from API for video ID: ${videoId}...`);
    const response = await axios.get("https://transcriptapi.com/api/v2/youtube/transcript", {
      params: {
        video_url: videoId,
        format: "json",
        send_metadata: "true",
      },
      headers: {
        Authorization: `Bearer ${config.transcriptApi.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const { transcript, metadata, language } = response.data;
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      throw new Error("No transcript available for this video");
    }

    const title = metadata?.title || "YouTube Video";

    // 3. Save to SourceCache asynchronously
    try {
      await SourceCache.findOneAndUpdate(
        { key: videoId, type: "youtube" },
        {
          key: videoId,
          type: "youtube",
          url: youtubeUrl,
          title,
          videoId,
          data: { transcript, metadata: metadata || {}, language },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`[SourceCache] STORED transcript for YouTube video: ${videoId}`);
    } catch (saveErr) {
      console.warn(`[SourceCache] Write error for YouTube video ${videoId}:`, saveErr.message);
    }

    return { transcript, metadata: metadata || {}, videoId, language };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const apiErrorMessage = error.response?.data?.message || error.message;
      throw new Error(`Transcript API Error (${statusCode}): ${apiErrorMessage}`);
    }
    throw error;
  }
}

/**
 * Normalizes YouTube transcript into structural Units (~120s windows).
 *
 * @param {string|Array} input - YouTube URL or raw transcript array
 * @param {number} [windowSeconds=120] - Window duration in seconds
 * @returns {Promise<{ units: Array, title: string, videoId: string }>}
 */
export async function getYoutubeUnits(input, windowSeconds = 120) {
  let transcript = [];
  let title = "YouTube Video";
  let videoId = "";

  if (Array.isArray(input)) {
    transcript = input;
  } else if (typeof input === "string") {
    const res = await fetchRawYouTubeTranscript(input);
    transcript = res.transcript;
    title = res.metadata?.title || "YouTube Video";
    videoId = res.videoId;
  } else {
    throw new Error("Invalid input provided to getYoutubeUnits: expected YouTube URL or transcript array");
  }

  const units = [];
  let cur = { text: "", start: null, end: null };

  const formatTs = (sec) => {
    const s = Math.floor(sec || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const remSec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(remSec)}`;
    return `${pad(m)}:${pad(remSec)}`;
  };

  for (const entry of transcript) {
    const entryStart = typeof entry.start === "number" ? entry.start : (typeof entry.offset === "number" ? entry.offset : 0);
    const entryDuration = typeof entry.duration === "number" ? entry.duration : 0;
    const entryText = (entry.text || "").trim();

    if (!entryText) continue;

    if (cur.start === null) cur.start = entryStart;
    cur.text += (cur.text ? " " : "") + entryText;
    cur.end = entryStart + entryDuration;

    if (cur.end - cur.start >= windowSeconds) {
      units.push(toUnit(cur));
      cur = { text: "", start: null, end: null };
    }
  }

  if (cur.text) {
    units.push(toUnit(cur));
  }

  return { units, title, videoId };

  function toUnit(c) {
    const startSec = Math.floor(c.start || 0);
    const endSec = Math.floor(c.end || startSec);
    return {
      text: c.text.trim(),
      tokens: Math.ceil(c.text.length / 4),
      rangeLabel: `${formatTs(startSec)}-${formatTs(endSec)}`,
      rangeStart: startSec,
      rangeEnd: endSec,
    };
  }
}
