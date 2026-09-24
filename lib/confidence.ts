// Normalization for the confidence score an extraction reports.
//
// Kept separate from the database access for the same reason as lib/dedupe.ts:
// the rule is where the bugs live and it is pure, so it can be tested without
// a database and without Ollama.
//
// EVENT_SCHEMA constrains confidence to `type: "number"` and marks it required,
// but a JSON Schema type is not a range and a small local model does not always
// honour even the type. Real extractions have arrived carrying 0, the literal
// string "high", booleans, and percentages such as 95. Every one of those has
// to land as a score the review queue can be read against, and none of them may
// end up looking more credible than the model actually was.

/**
 * Used when the extraction reported nothing usable. It sits above the 0.1 that
 * ingestion writes for output that would not parse at all, because a parsed row
 * with an unreadable score still carries real extracted fields a reviewer can
 * judge, while unparseable output carries none.
 */
export const UNRATED_CONFIDENCE = 0.3;

/**
 * A score counts only when it is a finite number inside the 0.0 to 1.0 range
 * the prompt asks for. Anything else is not a confidence the model expressed,
 * so it becomes UNRATED_CONFIDENCE rather than a guess at what was meant.
 *
 * Out of range values are deliberately not clamped. Clamping 95 to 1.0 would
 * promote a value that proves the model ignored the contract into the highest
 * confidence in the queue, which is the exact failure this function exists to
 * prevent. Reporting it as unrated is the honest reading: the score is unknown.
 */
export function normalizeConfidence(raw: unknown): number {
  if (typeof raw === "number") return inRange(raw) ? raw : UNRATED_CONFIDENCE;

  // Numeric strings are accepted because models frequently quote numbers.
  // An empty or non numeric string is not a score.
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return UNRATED_CONFIDENCE;
    const n = Number(trimmed);
    return inRange(n) ? n : UNRATED_CONFIDENCE;
  }

  // Booleans, null, undefined, objects and arrays. Note that `true` would
  // otherwise convert to 1, the top of the scale, on no evidence at all.
  return UNRATED_CONFIDENCE;
}

function inRange(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}
