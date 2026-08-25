import { estimateTokens } from "./tokenEstimator.utils.js";

/**
 * Greedily groups structural units into batches capped by token budget,
 * carrying the last unit forward into the next batch for topic continuity.
 * Automatically divides oversized units that exceed the token budget.
 *
 * @param {Array<{text: string, tokens: number, rangeLabel: string, rangeStart: number, rangeEnd: number}>} units
 * @param {number} [tokenBudget=8000] Target max tokens per batch
 * @returns {Array<{text: string, tokens: number, rangeLabel: string, rangeStart: number, rangeEnd: number, units: Array}>}
 */
export function createBatches(units, tokenBudget = 8000) {
  if (!Array.isArray(units) || units.length === 0) {
    return [];
  }

  // 1. Flatten / split any single units that exceed the token budget
  const normalizedUnits = [];
  for (const unit of units) {
    if (!unit.text || typeof unit.text !== "string") continue;
    const tokens = unit.tokens || estimateTokens(unit.text);

    if (tokens <= tokenBudget) {
      normalizedUnits.push({ ...unit, tokens });
    } else {
      // Sub-divide oversized unit
      const words = unit.text.split(/\s+/);
      const subUnitCount = Math.ceil(tokens / (tokenBudget * 0.75));
      const wordsPerSubUnit = Math.max(1, Math.floor(words.length / subUnitCount));

      for (let i = 0; i < words.length; i += wordsPerSubUnit) {
        const subText = words.slice(i, i + wordsPerSubUnit).join(" ");
        const subTokens = estimateTokens(subText);
        const partNum = Math.floor(i / wordsPerSubUnit) + 1;
        normalizedUnits.push({
          text: subText,
          tokens: subTokens,
          rangeLabel: `${unit.rangeLabel} (Part ${partNum})`,
          rangeStart: unit.rangeStart,
          rangeEnd: unit.rangeEnd,
        });
      }
    }
  }

  if (normalizedUnits.length === 0) return [];

  // 2. Greedily group units with 1-unit overlap across batch boundaries
  const batches = [];
  let cur = null;

  for (const unit of normalizedUnits) {
    if (!cur) {
      cur = { units: [unit], text: unit.text, tokens: unit.tokens };
      continue;
    }

    if (cur.tokens + unit.tokens > tokenBudget) {
      batches.push(finalize(cur));
      const lastUnit = cur.units[cur.units.length - 1]; // Overlap: carry last unit forward
      cur = {
        units: [lastUnit, unit],
        text: lastUnit.text + "\n\n" + unit.text,
        tokens: lastUnit.tokens + unit.tokens,
      };
    } else {
      cur.units.push(unit);
      cur.text += "\n\n" + unit.text;
      cur.tokens += unit.tokens;
    }
  }

  if (cur) {
    batches.push(finalize(cur));
  }

  return batches;

  function finalize(b) {
    const firstUnit = b.units[0];
    const lastUnit = b.units[b.units.length - 1];
    const rangeLabel =
      firstUnit.rangeLabel === lastUnit.rangeLabel
        ? firstUnit.rangeLabel
        : `${firstUnit.rangeLabel} to ${lastUnit.rangeLabel}`;

    return {
      text: b.units.map((u) => `--- [Source Location: ${u.rangeLabel}] ---\n${u.text}`).join("\n\n"),
      tokens: b.tokens,
      rangeStart: firstUnit.rangeStart,
      rangeEnd: lastUnit.rangeEnd,
      rangeLabel,
      units: b.units,
    };
  }
}
