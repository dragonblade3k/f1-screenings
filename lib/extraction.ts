// The extraction contract: the JSON Schema decoding is constrained to, and the
// prompt that goes with it.
//
// These two are one unit and are kept together, out of scripts/ingest.ts, for
// the same reason as lib/dedupe.ts and lib/price.ts: the rule is where the bugs
// live and it is pure, so it can be tested without SerpAPI, without Ollama and
// without a database. Importing scripts/ingest.ts from a test is not an option
// in any case, because it exits the process at module load when SERPAPI_API_KEY
// is unset and then runs a full ingest.
//
// The specific bug that moving them here guards against is drift between the
// two. They describe the same fields to the same model and a change to one is
// almost always wrong without the matching change to the other, but nothing
// before this made that check possible.

// Ollama's `format` accepts a real JSON Schema and constrains decoding to it,
// so the model structurally cannot emit a value outside an enum.
//
// The previous version passed format: "json" and described the shape inside
// the prompt as "area": "MUMBAI|THANE|NAVI_MUMBAI|UNKNOWN", meaning "pick one".
// format: "json" only guarantees the output parses, not that the values are
// legal, and the model took the pseudo notation literally: rows in the
// database still hold "MUMBAI|NAVI_MUMBAI" and "FP|QUALI|SPRINT|RACE|UNKNOWN"
// as single string values, and the literal word "string" wherever the sample
// showed "address": "string". Constraining decoding is what actually fixes it.
// This is invariant 1 in CLAUDE.md and lib/extraction.test.ts pins it.
//
// `priceINR` is deliberately absent from `required`. Under `type: "integer"`
// the model cannot decode a null, so leaving the field out is the only way it
// can say that the page stated no price, and `required` would take that away.
export const EVENT_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sport: { type: "string", enum: ["F1"] },
          area: { type: "string", enum: ["MUMBAI", "THANE", "NAVI_MUMBAI", "UNKNOWN"] },
          locality: { type: "string" },
          venueName: { type: "string" },
          address: { type: "string" },
          session: { type: "string", enum: ["FP", "QUALI", "SPRINT", "RACE", "UNKNOWN"] },
          startTimeIST: { type: "string" },
          priceINR: { type: "integer" },
          bookingUrl: { type: "string" },
          contact: { type: "string" },
          notes: { type: "string" },
          sourceUrl: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["area", "venueName", "session", "confidence"]
      }
    }
  },
  required: ["events"]
} as const;

/**
 * The instruction sent with EVENT_SCHEMA for one page.
 *
 * The priceINR line is the one worth reading carefully. It used to say
 * "integer, 0 when free or unknown", which was correct when priceINR was a
 * non-null column and both meanings had to share the value 0. The column is
 * nullable now and formatPrice renders null as "Price not listed" and 0 as
 * "Free entry", so an instruction to write 0 for a price nobody could read
 * publishes a paid screening as a free one. Omission is what the read path
 * expects and what the schema leaves room for.
 */
export function extractionPrompt(sourceUrl: string, title: string, pageText: string) {
  return `
You are extracting F1 screening events for the Mumbai Metro region ONLY (Mumbai, Thane, Navi Mumbai).

Rules:
- Include events only if they are clearly in Mumbai OR Thane OR Navi Mumbai (or localities within).
- If the page contains no relevant F1 screening event, return an empty events array.
- Choose exactly one area and exactly one session per event. Use UNKNOWN when unsure.
- Leave a string field empty rather than inventing a value or echoing a placeholder.
- startTimeIST: best effort ISO 8601 string, empty when unknown.
- priceINR: integer rupees. Use 0 ONLY when the page says entry is free. When the
  page states no price, omit the priceINR field entirely. Never write 0 to mean
  that the price is unknown.
- confidence: 0.0 to 1.0, how sure you are this is a real F1 screening in the region.

Source URL: ${sourceUrl}
Title: ${title}

Page text:
${pageText}
`.trim();
}
