import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "../../lib/openai.lib.js";
import { config } from "../../config/env.js";
import { pLimit } from "../../utils/pLimit.utils.js";
import { SegmentBatchSchema } from "../../utils/responseSchema.utils.js";

/**
 * Extracts structured analytical segments from a list of document batches in parallel,
 * bounded by a concurrency limiter to protect against OpenAI rate limits.
 *
 * @param {Array<{ text: string, rangeLabel: string, rangeStart: number, rangeEnd: number, tokens: number }>} batches
 * @param {number} [concurrency=5] Maximum parallel LLM calls
 * @returns {Promise<Array<{ rangeLabel: string, rangeStart: number, rangeEnd: number, topicHint: string, summary: string, takeaways: string[], terms: Array<{term: string, definition: string}> }>>}
 */
export async function extractBatchSegments(batches, concurrency = 5) {
  if (!Array.isArray(batches) || batches.length === 0) {
    return [];
  }

  const limit = pLimit(concurrency);
  const modelName = config.openai.chatModel || "gpt-4o-mini";

  console.log(`[Studio Outline Extractor] Extracting segments from ${batches.length} batch(es) with concurrency limit = ${concurrency}...`);

  const tasks = batches.map((batch, index) =>
    limit(async () => {
      console.log(`  → Processing Batch ${index + 1}/${batches.length} (${batch.rangeLabel}, ~${batch.tokens} tokens)...`);
      try {
        const completion = await openai.chat.completions.parse({
          model: modelName,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "You are an expert analytical archivist and comprehensive research synthesizer across all academic, technical, business, and humanities domains.\n" +
                "Your objective is to perform a HIGH-DENSITY, fine-grained extraction of every distinct topic, argument shift, case study, conceptual framework, or analogy in this document slice.\n\n" +
                "MANDATORY 100% COVERAGE INVARIANT (NO GAPS):\n" +
                "- You MUST partition and cover the ENTIRE batch slice from the exact starting coordinate to the ending coordinate with ZERO GAPS.\n" +
                "- Do NOT treat this as selective highlights or skip sections. Every sentence, idea, and unit in the batch slice must belong to one of your segments.\n" +
                "- Consecutive segments within the batch must connect seamlessly.\n\n" +
                "EXTRACTION PRINCIPLES:\n" +
                "1. GRANULAR SEGMENTATION: Break the slice into focused, distinct segments whenever the subject matter, line of reasoning, example, or sub-topic changes (typically 3 to 8 minutes each, or 2 to 5 pages).\n" +
                "2. PRESERVE SPECIFICS & NUANCES: Extract concrete examples, analogies, comparative models, critique of tools/methodologies, domain principles, and unique arguments rather than generalized high-level summaries.\n" +
                "3. ACCURATE COORDINATES: For each segment, provide the accurate `rangeStart` and `rangeEnd` numerical coordinates and human-readable `rangeLabel` corresponding to that segment's exact slice boundaries.\n" +
                "4. DENSE TAKEAWAYS: For each segment, provide 4-8 specific, granular takeaway points capturing the actual assertions, steps, arguments, or insights presented.\n" +
                "5. DOMAIN TERMINOLOGY: Extract all specialized terminology, jargon, theories, metaphors, or named entities introduced in the text with precise definitions as used in context.\n" +
                "6. TOPIC HINT: Provide a 2-5 word descriptive label capturing the core theme of the segment.",

            },
            {
              role: "user",
              content: `Batch Coordinate: ${batch.rangeLabel} (Coordinates: ${batch.rangeStart} to ${batch.rangeEnd})\n\nContent:\n${batch.text}`,
            },

          ],
          response_format: zodResponseFormat(SegmentBatchSchema, "segment_batch"),
        });

        const parsed = completion.choices[0].message.parsed;
        const segments = parsed?.segments || [];
        console.log(`  ✓ Batch ${index + 1}/${batches.length} extracted ${segments.length} segment(s)`);
        return segments;
      } catch (err) {
        console.error(`[Studio Outline Extractor] Error in Batch ${index + 1} (${batch.rangeLabel}):`, err.message);
        throw err;
      }
    })
  );

  const results = await Promise.all(tasks);
  const flatSegments = results.flat();
  console.log(`[Studio Outline Extractor] Total segments extracted across all batches: ${flatSegments.length}`);
  return flatSegments;
}
