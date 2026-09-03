import { describe, it, expect } from "vitest";
import { isSameEvent, normalizeKey } from "./dedupe";

const at = (venueName: string, startTimeIST: string) => ({ venueName, startTimeIST });

describe("normalizeKey", () => {
  it("lowercases, collapses whitespace and trims", () => {
    expect(normalizeKey("  Doolally   Taproom ")).toBe("doolally taproom");
  });

  it("handles absent values", () => {
    expect(normalizeKey(null)).toBe("");
    expect(normalizeKey(undefined)).toBe("");
  });
});

describe("isSameEvent", () => {
  it("matches identical extractions", () => {
    const a = at("Doolally Taproom", "2026-03-15T18:30:00+05:30");
    expect(isSameEvent(a, { ...a })).toBe(true);
  });

  // The reason the comparison is normalized rather than exact: the same venue
  // arrives spelled differently from different sources.
  it("matches across case and spacing differences", () => {
    expect(
      isSameEvent(
        at("Doolally Taproom", "2026-03-15T18:30:00+05:30"),
        at("doolally  TAPROOM", "2026-03-15T18:30:00+05:30")
      )
    ).toBe(true);
  });

  it("separates different venues at the same time", () => {
    expect(
      isSameEvent(
        at("Doolally Taproom", "2026-03-15T18:30:00+05:30"),
        at("The Bar Stock Exchange", "2026-03-15T18:30:00+05:30")
      )
    ).toBe(false);
  });

  it("separates the same venue at different times", () => {
    expect(
      isSameEvent(
        at("Doolally Taproom", "2026-03-15T18:30:00+05:30"),
        at("Doolally Taproom", "2026-03-29T18:30:00+05:30")
      )
    ).toBe(false);
  });

  it("matches when neither extraction found a time", () => {
    expect(isSameEvent(at("Doolally Taproom", ""), at("Doolally Taproom", ""))).toBe(true);
  });

  // Guards the failure mode that would be worst in production: collapsing
  // every row whose venue the model could not read into one duplicate, and
  // silently discarding real events.
  it("never matches an extraction with no venue name", () => {
    expect(isSameEvent(at("", "2026-03-15T18:30:00+05:30"), at("", "2026-03-15T18:30:00+05:30"))).toBe(false);
    expect(isSameEvent(at("", ""), at("Doolally Taproom", ""))).toBe(false);
    expect(isSameEvent(at("Doolally Taproom", ""), at("", ""))).toBe(false);
  });
});
