// src/loaders/youtube.loader.js
import axios from "axios";
import { Document } from "@langchain/core/documents";
import { config } from "../config/env.js";

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

      // Carry the last few segments forward as overlap, same idea as
      // RecursiveCharacterTextSplitter carrying whole lines forward
      currentSegments = currentSegments.slice(-overlapSegments);
      currentLength = currentSegments.reduce((sum, s) => sum + s.text.length, 0);
    }
  }

  return chunks;
}

export async function loadYoutubeTranscript(youtubeUrl) {
  const videoId = extractVideoId(youtubeUrl);

  try {
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

    const chunks = chunkTranscriptWithTimestamps(transcript, {
      chunkSize: config.chunking?.chunkSize || 800,
      overlapSegments: 2,
    });

    const documents = chunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.text,
          metadata: {
            source: youtubeUrl,
            sourceType: "youtube",
            videoId: videoId,
            startSeconds: chunk.startSeconds,
            title: metadata?.title || "YouTube Video",
            author: metadata?.author_name || "Unknown Author",
            language: language || "hi",
          },
        })
    );

    return documents;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const apiErrorMessage = error.response?.data?.message || error.message;
      throw new Error(`Transcript API Error (${statusCode}): ${apiErrorMessage}`);
    }
    throw error;
  }
}