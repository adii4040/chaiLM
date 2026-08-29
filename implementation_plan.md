# Implementation Plan - Upstream Batch Extraction Coverage & Conditional Analogy Rules

Address the root causes identified in the latest trace analysis:
1. **Batch Segment Collapse (Under-dense Extraction)**: Batch 1 (3,514 tokens, ~12 minutes) collapsed into a single segment at extraction time, compressing out ~10 minutes of plot content and leading to downstream attribution errors.
2. **Fabricated Analogy Mappings**: Studio prompts unconditionally forced LLMs to invent technical mappings even when the source outline summary provided no explicit mapping.

---

## User Review Required

> [!IMPORTANT]
> - **Batch Extraction Fix**: Adds a `verifyBatchCoverage` check in `outlineExtractor.service.js`. If a batch (> 300 seconds or > 1,500 tokens) returns only 1 segment, it automatically splits the batch in half and re-extracts segments for complete coverage.
> - **Conditional Analogy Rules**: Modifies `flashDeck.artifcat.formatter.js`, `quiz.artifact.formatter.js`, and `studyGuide.artifact.formatter.js` so that technical re-framing of analogies occurs ONLY if an explicit technical mapping is present in the source outline. Otherwise, the model must NOT invent a mapping.

---

## Proposed Changes

### 1. Batch Extraction Layer (`src/services/ai/outlineExtractor.service.js`)

#### [MODIFY] [outlineExtractor.service.js](file:///c:/Users/redHair/Documents/Chai%20aur%20GenAI/RAG/chaiLM/server/src/services/ai/outlineExtractor.service.js)

- Implement `verifyBatchCoverage(batch, segments)`:
  - Check if a batch span is large (> 300 seconds or > 1,500 tokens) yet yielded only 1 segment.
  - If collapsed, automatically split `batch` into two equal sub-batches and extract segments for each sub-batch in parallel.
- Update system prompt instructions:
  - Explicitly mandate segment density proportional to batch length (minimum 2–4 segments for slices > 5 minutes).

---

### 2. Studio Prompt Formatters (`src/prompt/formatters/artifacts/`)

#### [MODIFY] [flashDeck.artifcat.formatter.js](file:///c:/Users/redHair/Documents/Chai%20aur%20GenAI/RAG/chaiLM/server/src/prompt/formatters/artifacts/flashDeck.artifcat.formatter.js)

- Update `TECHNICAL ANALOGY MAPPING RULE` to be **conditional**:
  - *IF AND ONLY IF* the source outline explicitly provides a technical mapping, reframe the card around that mapping.
  - *IF NO MAPPING IS PROVIDED*, do NOT invent or fabricate a technical mapping.

#### [MODIFY] [quiz.artifact.formatter.js](file:///c:/Users/redHair/Documents/Chai%20aur%20GenAI/RAG/chaiLM/server/src/prompt/formatters/artifacts/quiz.artifact.formatter.js)

- Update `TECHNICAL ANALOGY QUESTION RULE` to be **conditional**:
  - *IF AND ONLY IF* an explicit technical mapping exists in the outline, format the question around that mapping.
  - Otherwise, assess the source concept literally or skip generating an analogy question.

#### [MODIFY] [studyGuide.artifact.formatter.js](file:///c:/Users/redHair/Documents/Chai%20aur%20GenAI/RAG/chaiLM/server/src/prompt/formatters/artifacts/studyGuide.artifact.formatter.js)

- Update `ANALOGY TRANSLATION RULE` to be **conditional**:
  - *IF AND ONLY IF* an explicit technical mapping is in the outline, translate it into computer science terminology.
  - Otherwise, describe the analogy faithfully without inventing fabricated mappings.

---

## Verification Plan

### Automated / Unit Test
- Run a test script on `extractBatchSegments` with a large batch (~3,500 tokens) to verify that `verifyBatchCoverage` triggers sub-batch splitting and extracts multiple granular segments.

### Studio Artifact Verification
- Re-run Studio artifact generation for the source and inspect `test01.json` to verify:
  1. Full segment extraction across the entire 12-minute span (including prophecy speech, Baela/Rhaena conflict, Septon murder, Mysaria exile).
  2. No fabricated technical mappings when source outline lacks explicit mapping.
