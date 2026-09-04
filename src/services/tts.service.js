import OpenAI from "openai";
import { config } from "../config/env.js";

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Generates speech audio from text using OpenAI's TTS model (gpt-4o-mini-tts).
 *
 * @param {string} text - The text to synthesize into speech.
 * @param {string} [instructions] - Natural-language delivery guidance / instructions for pacing, tone, and emphasis.
 * @param {string} [voice="alloy"] - Voice choice (e.g. "alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral", "verse", "ballad", "sage", "ash").
 * @param {number} [speed=1.0] - Playback speed of the generated audio (0.25 to 4.0).
 * @param {"mp3" | "opus" | "aac" | "flac" | "wav" | "pcm"} [responseFormat="mp3"] - The format of audio output.
 * @returns {Promise<Buffer>} Buffer containing the generated audio.
 */
export async function generateSpeech(text, instructions, voice = "alloy", speed = 1.0, responseFormat = "mp3") {
  if (!text) {
    throw new Error("Text is required for TTS generation.");
  }

  const payload = {
    model: "gpt-4o-mini-tts",
    voice,
    input: text,
    speed,
    response_format: responseFormat,
  };

  if (instructions) {
    payload.instructions = instructions;
  }

  const response = await openai.audio.speech.create(payload);
  const arrayBuffer = await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

export default generateSpeech;
