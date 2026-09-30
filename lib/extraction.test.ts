import { describe, it, expect } from "vitest";
import { EVENT_SCHEMA, extractionPrompt } from "./extraction";
import { areaLabel, sessionLabel, formatPrice } from "./format";

const item = EVENT_SCHEMA.properties.events.items;
const props = item.properties;

// Asserting on a prompt string is unusual, so it is worth saying why these
// earn their place. The prompt is the only statement of field semantics the
// model ever sees, and nothing else in the repo references it, so when the
// priceINR column became nullable the prompt kept telling the model to write 0
// for an unknown price and no type, test or build caught it. Every rule below
// pins the prompt or the schema against the read path that consumes it.
const priceRule = extractionPrompt("", "", "")
  .split("\n")
  .filter((l) => l.includes("priceINR"))
  .join(" ");

describe("EVENT_SCHEMA", () => {
  // Invariant 1. Decoding is constrained to a real JSON Schema with enum
  // arrays, not format: "json" with the shape described in prose. Dropping
  // either enum is what produced "MUMBAI|NAVI_MUMBAI" as a single value.
  it("constrains area and session to enumerated values", () => {
    expect(props.area.enum).toEqual(["MUMBAI", "THANE", "NAVI_MUMBAI", "UNKNOWN"]);
    expect(props.session.enum).toEqual(["FP", "QUALI", "SPRINT", "RACE", "UNKNOWN"]);
  });

  // The read path can only label values it knows. If the extractor learns a new
  // session or area and lib/format.ts is not taught it in the same change, the
  // page silently prints "Session TBC" for a session the model read correctly.
  it("emits no area the display layer cannot label", () => {
    for (const a of props.area.enum.filter((v) => v !== "UNKNOWN")) {
      expect(areaLabel(a)).not.toBe("Area unconfirmed");
    }
    expect(areaLabel("UNKNOWN")).toBe("Area unconfirmed");
  });

  it("emits no session the display layer cannot label", () => {
    for (const s of props.session.enum.filter((v) => v !== "UNKNOWN")) {
      expect(sessionLabel(s)).not.toBe("Session TBC");
    }
    expect(sessionLabel("UNKNOWN")).toBe("Session TBC");
  });

  // Under type: "integer" the model cannot decode a null, so omitting the field
  // is its only way to report that the page stated no price. Making priceINR
  // required would remove that and force a number where there is no number.
  it("leaves priceINR optional so an absent price stays expressible", () => {
    expect(props.priceINR.type).toBe("integer");
    expect(item.required).not.toContain("priceINR");
  });

  // Ingestion skips an event with no venueName and normalizeConfidence has to
  // have something to normalize, so these two are the fields the write path
  // genuinely cannot proceed without.
  it("requires the fields the write path depends on", () => {
    expect(item.required).toContain("venueName");
    expect(item.required).toContain("confidence");
  });
});

describe("extractionPrompt", () => {
  it("carries the page it is asking about", () => {
    const p = extractionPrompt("https://example.com/f1", "Race night", "Doolally, 8pm");
    expect(p).toContain("https://example.com/f1");
    expect(p).toContain("Race night");
    expect(p).toContain("Doolally, 8pm");
  });

  // null and 0 are different answers on a public page: formatPrice renders one
  // as "Price not listed" and the other as "Free entry". An instruction to
  // write 0 for an unknown price collapses them again at the source and
  // advertises a paid screening as free.
  it("asks for an omitted price rather than a zero when none is stated", () => {
    expect(formatPrice(null).text).not.toBe(formatPrice(0).text);
    expect(priceRule).toMatch(/omit/i);
    expect(priceRule).not.toMatch(/0 when free or unknown/i);
  });

  it("reserves zero for a genuinely free entry", () => {
    expect(formatPrice(0).free).toBe(true);
    expect(priceRule).toMatch(/free/i);
  });
});
