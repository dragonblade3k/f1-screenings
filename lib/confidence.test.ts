import { describe, it, expect } from "vitest";
import { normalizeConfidence, UNRATED_CONFIDENCE } from "./confidence";

describe("normalizeConfidence", () => {
  it("keeps a score the model actually reported", () => {
    expect(normalizeConfidence(0.85)).toBe(0.85);
    expect(normalizeConfidence(0.1)).toBe(0.1);
  });

  it("keeps both ends of the scale", () => {
    expect(normalizeConfidence(1)).toBe(1);
    expect(normalizeConfidence(0)).toBe(0);
  });

  it("does not turn a reported zero into a default", () => {
    // Zero is the model saying this is not a real screening. Reading it as
    // absent and substituting the unrated default made junk outrank rows the
    // model was genuinely unsure about.
    expect(normalizeConfidence(0)).not.toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence("0")).toBe(0);
    expect(normalizeConfidence("0.0")).toBe(0);
  });

  it("reads a quoted number", () => {
    expect(normalizeConfidence("0.85")).toBe(0.85);
    expect(normalizeConfidence(" 0.4 ")).toBe(0.4);
  });

  it("reports an absent field as unrated", () => {
    expect(normalizeConfidence(undefined)).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence(null)).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence("")).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence("   ")).toBe(UNRATED_CONFIDENCE);
  });

  it("reports a word as unrated instead of NaN", () => {
    // NaN reached Prisma and SQLite rejected it against a non nullable column,
    // which aborted the whole page rather than this one event.
    expect(normalizeConfidence("high")).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence(NaN)).toBe(UNRATED_CONFIDENCE);
    expect(Number.isNaN(normalizeConfidence("high"))).toBe(false);
  });

  it("does not promote an out of range value", () => {
    expect(normalizeConfidence(95)).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence(1.5)).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence(Infinity)).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence(-0.5)).toBe(UNRATED_CONFIDENCE);
  });

  it("does not read a boolean as a score", () => {
    expect(normalizeConfidence(true)).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence(false)).toBe(UNRATED_CONFIDENCE);
  });

  it("reports a non scalar as unrated", () => {
    expect(normalizeConfidence({ value: 0.9 })).toBe(UNRATED_CONFIDENCE);
    expect(normalizeConfidence([0.9])).toBe(UNRATED_CONFIDENCE);
  });

  it("always returns a value the schema can store", () => {
    const inputs = [0, 1, 0.5, "0.2", "high", NaN, Infinity, -1, 95, true, null, undefined, {}, []];
    for (const raw of inputs) {
      const n = normalizeConfidence(raw);
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});
