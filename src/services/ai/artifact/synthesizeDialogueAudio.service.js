import pLimit from "p-limit";
import { generateSpeech } from "../../tts.service.js";

const VOICE_MAP = {
    "Host 1": "onyx",
    "Host 2": "nova",
};

const limit = pLimit(5); // matches your existing embedding-batch concurrency pattern

/**
 * Synthesizes TTS audio for every line in a dialogue script.
 * Does NOT stitch or upload — returns ordered buffers for the next pipeline step.
 *
 * @param {Array<{speaker: string, text: string, ai_instruction: string}>} dialogue
 * @returns {Promise<Array<{speaker: string, buffer: Buffer}>>}
 */
export async function synthesizeDialogueAudio(dialogue) {
    const results = await Promise.all(
        dialogue.map((line, index) =>
            limit(async () => {
                const buffer = await generateSpeech(
                    line.text,
                    line.ai_instruction,
                    VOICE_MAP[line.speaker] || "alloy"
                );
                return { index, speaker: line.speaker, buffer };
            })
        )
    );

    // Promise.all with pLimit preserves order via the index, but sort explicitly to be safe
    return results.sort((a, b) => a.index - b.index);
}