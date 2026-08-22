import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "../../lib/openai.lib.js";
import { config } from "../../config/env.js";
import { OutlineSchema } from "../../utils/responseSchema.utils.js";

/**
 * Programmatically detects and merges segment duplicates created by batch boundary overlap.
 * If two segments have >= 50% coordinate overlap or identical rangeLabel,
 * they are merged into one segment before the LLM sees them.
 *
 * @param {Array<Object>} segments
 * @param {number} [overlapThreshold=0.5]
 * @returns {Array<Object>}
 */
export function preMergeCollidingSegments(segments, overlapThreshold = 0.5) {
  if (!Array.isArray(segments) || segments.length <= 1) return segments || [];

  // Sort by start coordinate ascending, end coordinate ascending
  const sorted = [...segments].sort((a, b) => {
    if (a.rangeStart !== b.rangeStart) return a.rangeStart - b.rangeStart;
    return a.rangeEnd - b.rangeEnd;
  });

  const merged = [];
  for (const seg of sorted) {
    if (merged.length === 0) {
      merged.push({ ...seg, takeaways: [...(seg.takeaways || [])], terms: [...(seg.terms || [])] });
      continue;
    }

    const prev = merged[merged.length - 1];

    const overlapStart = Math.max(prev.rangeStart, seg.rangeStart);
    const overlapEnd = Math.min(prev.rangeEnd, seg.rangeEnd);
    const overlapLen = Math.max(0, overlapEnd - overlapStart);

    const prevLen = Math.max(1, prev.rangeEnd - prev.rangeStart);
    const segLen = Math.max(1, seg.rangeEnd - seg.rangeStart);
    const minLen = Math.min(prevLen, segLen);

    const isOverlapCollision = (minLen > 0 && overlapLen / minLen >= overlapThreshold);
    const isLabelCollision = (prev.rangeLabel && seg.rangeLabel && prev.rangeLabel.trim() === seg.rangeLabel.trim());

    if (isOverlapCollision || isLabelCollision) {
      console.log(`[Studio Pre-Merge] Merging colliding overlap segments: "${prev.rangeLabel}" (${prev.topicHint}) + "${seg.rangeLabel}" (${seg.topicHint})`);
      prev.rangeStart = Math.min(prev.rangeStart, seg.rangeStart);
      prev.rangeEnd = Math.max(prev.rangeEnd, seg.rangeEnd);
      prev.summary = `${prev.summary}\n${seg.summary}`.trim();
      prev.takeaways = Array.from(new Set([...(prev.takeaways || []), ...(seg.takeaways || [])]));

      const existingTerms = new Set((prev.terms || []).map((t) => t.term.toLowerCase()));
      for (const t of seg.terms || []) {
        if (!existingTerms.has(t.term.toLowerCase())) {
          prev.terms.push(t);
          existingTerms.add(t.term.toLowerCase());
        }
      }

      const existingEntities = new Set((prev.keyEntities || []).map((e) => e.entity.toLowerCase()));
      for (const e of seg.keyEntities || []) {
        if (!existingEntities.has(e.entity.toLowerCase())) {
          prev.keyEntities = prev.keyEntities || [];
          prev.keyEntities.push(e);
          existingEntities.add(e.entity.toLowerCase());
        }
      }

      if (seg.topicHint && !prev.topicHint.toLowerCase().includes(seg.topicHint.toLowerCase())) {
        prev.topicHint = `${prev.topicHint} & ${seg.topicHint}`;
      }
    } else {
      merged.push({
        ...seg,
        keyEntities: [...(seg.keyEntities || [])],
        takeaways: [...(seg.takeaways || [])],
        terms: [...(seg.terms || [])],
      });
    }
  }

  return merged;
}

/**
 * Reconciles and merges extracted document segments into coherent, chronological chapters.
 * Deterministically collapses overlap duplicates before and after LLM synthesis.
 *
 * @param {Array<Object>} segments - Array of extracted segments from all batches
 * @param {string} [documentTitle="Untitled Source"] - Title of the document
 * @returns {Promise<{ chapters: Array<{ chapterIndex: number, chapterTitle: string, rangeLabel: string, rangeStart: number, rangeEnd: number, summary: string, takeaways: string[], terms: Array<{term: string, definition: string}> }> }>}
 */
export async function reconcileOutline(segments, documentTitle = "Untitled Source") {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { chapters: [] };
  }

  const modelName = config.openai.outlineModel || "gpt-5-mini";


  // 1. Programmatically collapse boundary overlap collisions
  const rawCleanSegments = preMergeCollidingSegments(segments);
  const cleanSegments = rawCleanSegments.map((seg, idx) => ({
    segmentId: idx + 1,
    ...seg,
  }));

  const sampleLabel = cleanSegments[0]?.rangeLabel || "";
  const isTimestamp = sampleLabel.includes(":") || cleanSegments.some((s) => typeof s.rangeEnd === "number" && s.rangeEnd > 500);
  const isPage = sampleLabel.toLowerCase().includes("page");

  const groupingGuidance = isPage
    ? "DOCUMENT / PDF GROUPING RULES:\n" +
      "- Group approximately 6 to 12 pages into ONE comprehensive section (e.g. Pages 1-8, Pages 9-18, etc.).\n" +
      "- Do NOT output tiny 1-page chapters or giant 50-page blobs. Each section must group logically related segments into a cohesive thematic block.\n" +
      "- Name each section with a clear thematic title, e.g. 'Section 1: Executive Overview & Architecture', 'Section 2: Web Services Security Standards'.\n" +
      "- Target approximately 8 to 15 total sections for a large document (100-150 pages), or 3 to 6 sections for short documents (10-30 pages)."
    : "AUDIO / VIDEO GROUPING RULES:\n" +
      "- Group segments into balanced 3 to 8 minute chapters for shorter media (<30 mins) or 8 to 12 minute chapters for long streams.\n" +
      "- Do NOT output 1-minute micro-chapters, and do NOT lump entire 15-minute storylines with multiple scene pivots into 1 giant chapter.\n" +
      "- Target 4 to 7 focused chapters for a 20-30 minute video, and 5 to 9 chapters for a 1-hour stream.";

  console.log(`[Studio Outline Merge] Reconciling ${cleanSegments.length} deduplicated segment(s) (down from ${segments.length} raw) for "${documentTitle}" (${isPage ? "PDF/Document" : "Media/Audio"})...`);

  try {
    const completion = await openai.chat.completions.parse({
      model: modelName,
      messages: [
        {
          role: "system",
          content:
            "You are an expert editorial curator and document architect across all fields of study, technology, narrative, business, and literature.\n" +
            "You are given a chronological sequence of extracted document segments from a multi-batch pipeline, each labeled with a unique `segmentId` (1 to " + cleanSegments.length + ").\n" +
            "Your task is to organize these segments into an outline of coherent, well-proportioned, beautifully structured sections.\n\n" +
            "MANDATORY ALL-SEGMENT COVERAGE INVARIANT:\n" +
            "1. EVERY SINGLE `segmentId` from 1 to " + cleanSegments.length + " MUST be included in the `includedSegmentIds` array of exactly one section.\n" +
            "2. It is STRICTLY FORBIDDEN to drop, skip, or omit any segment. The sections must collectively cover all segments from Segment 1 to Segment " + cleanSegments.length + ".\n\n" +
            groupingGuidance + "\n\n" +
            "STRICT SYNTHESIS & LOSSLESS PRESERVATION RULES:\n" +
            "1. FULL UNION OF TAKEAWAYS: When merging segments into a section, you MUST preserve all unique assertions, plot developments, character actions, arguments, formulas, and technical takeaways from the input segments. Do NOT discard granular points to make the list short.\n" +
            "2. EXACT ATTRIBUTION FIDELITY: Inspect the `keyEntities` and explicit subject attributions in each segment. Never alter, guess, or re-attribute which character/entity did what. Maintain 100% fidelity to the entity bindings established in the input segments.\n" +
            "3. RICH NARRATIVE SUMMARY: Write a comprehensive, multi-sentence paragraph summary for each chapter that chronologically covers every constituent segment.\n" +
            "4. DEDUPLICATED GLOSSARY: Deduplicate vocabulary terms across merged segments, retaining the clearest and most precise definitions.\n" +
            "5. SEQUENTIAL INDEX: Ensure sequential `chapterIndex` (1, 2, 3...).\n\n" +
            "LANGUAGE NORMALIZATION:\n" +
            "Regardless of the language of the source content, all output (summaries, takeaways, terms, topicHint, chapterTitle) must be written entirely in English. Transliterate or translate any names, places, and terminology from the source language into their standard English spellings or accepted English equivalents. Do not mix scripts or languages within a single output field — every word must be in English, even when extracting from a non-English source.",
        },
        {
          role: "user",
          content: `Document Title: ${documentTitle}\n\nTotal Segments to Assign: ${cleanSegments.length}\n\nExtracted Segments JSON (Chronological Order with Key Entities & Takeaways):\n${JSON.stringify(cleanSegments, null, 2)}`,
        },
      ],
      response_format: zodResponseFormat(OutlineSchema, "master_outline"),
    });




    const parsed = completion.choices[0].message.parsed;
    let rawChapters = parsed?.chapters || [];

    // Fallback: If no chapters returned, generate 1:1 chapters from segments
    if (rawChapters.length === 0 && cleanSegments.length > 0) {
      rawChapters = cleanSegments.map((seg, idx) => ({
        chapterIndex: idx + 1,
        chapterTitle: seg.topicHint || `Chapter ${idx + 1}`,
        includedSegmentIds: [seg.segmentId],
        rangeLabel: seg.rangeLabel,
        rangeStart: seg.rangeStart,
        rangeEnd: seg.rangeEnd,
        summary: seg.summary,
        takeaways: seg.takeaways || [],
        terms: seg.terms || [],
      }));
    }

    // 2. Post-processing guarantee: Ensure mathematical boundary calculation and zero gaps
    const sampleLabel = cleanSegments[0]?.rangeLabel || "";
    const isTimestamp = sampleLabel.includes(":") || cleanSegments.some((s) => typeof s.rangeEnd === "number" && s.rangeEnd > 500);
    const isPage = sampleLabel.toLowerCase().includes("page");

    const formatTs = (sec) => {
      const s = Math.floor(sec || 0);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const remSec = s % 60;
      const pad = (n) => String(n).padStart(2, "0");
      if (h > 0) return `${pad(h)}:${pad(m)}:${pad(remSec)}`;
      return `${pad(m)}:${pad(remSec)}`;
    };

    const segmentMap = new Map(cleanSegments.map((s) => [s.segmentId, s]));

    // Map chapters to actual segment boundaries
    let chapters = rawChapters.map((chap, idx) => {
      const assignedSegments = (chap.includedSegmentIds || [])
        .map((id) => segmentMap.get(id))
        .filter(Boolean);

      let cStart = typeof chap.rangeStart === "number" ? chap.rangeStart : null;
      let cEnd = typeof chap.rangeEnd === "number" ? chap.rangeEnd : null;

      if (assignedSegments.length > 0) {
        cStart = Math.min(...assignedSegments.map((s) => s.rangeStart));
        cEnd = Math.max(...assignedSegments.map((s) => s.rangeEnd));
      }

      return {
        ...chap,
        chapterIndex: idx + 1,
        rangeStart: cStart,
        rangeEnd: cEnd,
      };
    });

    // Ensure timeline continuity across consecutive chapters (no gaps)
    for (let i = 0; i < chapters.length; i++) {
      if (i === 0 && typeof cleanSegments[0]?.rangeStart === "number") {
        if (chapters[i].rangeStart === null || chapters[i].rangeStart > cleanSegments[0].rangeStart) {
          chapters[i].rangeStart = cleanSegments[0].rangeStart;
        }
      }
      if (i > 0 && typeof chapters[i - 1].rangeEnd === "number") {
        // Connect seamless boundary with previous chapter
        if (chapters[i].rangeStart === null || chapters[i].rangeStart > chapters[i - 1].rangeEnd) {
          chapters[i].rangeStart = chapters[i - 1].rangeEnd;
        }
      }
      if (i === chapters.length - 1 && typeof cleanSegments[cleanSegments.length - 1]?.rangeEnd === "number") {
        const lastEnd = cleanSegments[cleanSegments.length - 1].rangeEnd;
        if (chapters[i].rangeEnd === null || chapters[i].rangeEnd < lastEnd) {
          chapters[i].rangeEnd = lastEnd;
        }
      }
    }

    // Format rangeLabel deterministically
    chapters = chapters.map((chap) => {
      let formattedLabel = chap.rangeLabel;
      if (typeof chap.rangeStart === "number" && typeof chap.rangeEnd === "number") {
        if (isPage) {
          formattedLabel = chap.rangeStart === chap.rangeEnd ? `Page ${chap.rangeStart}` : `Pages ${chap.rangeStart}-${chap.rangeEnd}`;
        } else if (isTimestamp) {
          formattedLabel = `${formatTs(chap.rangeStart)}-${formatTs(chap.rangeEnd)}`;
        }
      }
      return {
        ...chap,
        rangeLabel: formattedLabel,
      };
    });

    console.log(`[Studio Outline Merge] Successfully synthesized ${chapters.length} chapter(s) for "${documentTitle}".`);
    return { chapters };
  } catch (error) {
    console.error("[Studio Outline Merge Error]:", error);
    throw new Error(`Failed to reconcile master outline: ${error.message}`);
  }
}


