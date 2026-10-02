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

  // The reason the time is compared as an instant rather than as text. The
  // prompt asks for a "best effort ISO 8601 string", so the same 6:30 pm
  // arrives from different pages in different legal spellings, and on text
  // each spelling was a separate event. Both of these render identically in
  // the review queue, so a human had no way to catch what the rule missed.
  it("matches the same moment written in different ISO spellings", () => {
    const explicit = at("Doolally Taproom", "2026-03-15T18:30:00+05:30");
    expect(isSameEvent(explicit, at("Doolally Taproom", "2026-03-15T18:30"))).toBe(true);
    expect(isSameEvent(explicit, at("Doolally Taproom", "2026-03-15T18:30:00"))).toBe(true);
    expect(isSameEvent(explicit, at("Doolally Taproom", "2026-03-15T13:00:00Z"))).toBe(true);
  });

  it("separates times that only look close", () => {
    const a = at("Doolally Taproom", "2026-03-15T18:30");
    expect(isSameEvent(a, at("Doolally Taproom", "2026-03-15T19:30"))).toBe(false);
    expect(isSameEvent(a, at("Doolally Taproom", "2026-03-15T18:31"))).toBe(false);
    // Same wall clock reading, different zone, so a different moment.
    expect(isSameEvent(a, at("Doolally Taproom", "2026-03-15T18:30:00Z"))).toBe(false);
  });

  // The guard on widening. A date with no time means the page never printed
  // one; parsed as an instant it lands on 05:30 IST, which is also what a
  // stated 05:30 parses to. Those are different claims and must not merge, so
  // a comparison involving a bare date stays on the text it always used.
  it("never merges a date with no time into a stated time", () => {
    expect(isSameEvent(at("Doolally Taproom", "2026-03-15"), at("Doolally Taproom", "2026-03-15T05:30"))).toBe(false);
    expect(isSameEvent(at("Doolally Taproom", "2026-03-15"), at("Doolally Taproom", "2026-03-15T00:00"))).toBe(false);
    expect(isSameEvent(at("Doolally Taproom", "2026-03-15"), at("Doolally Taproom", "2026-03-15"))).toBe(true);
  });

  // Unparseable text is still matched on the text, which is all there is.
  it("falls back to the text when a time does not parse", () => {
    expect(isSameEvent(at("Doolally Taproom", "8 PM Sunday"), at("Doolally Taproom", "8 pm  SUNDAY"))).toBe(true);
    expect(isSameEvent(at("Doolally Taproom", "8 PM Sunday"), at("Doolally Taproom", "9 PM Sunday"))).toBe(false);
    expect(isSameEvent(at("Doolally Taproom", "8 PM Sunday"), at("Doolally Taproom", "2026-03-15T20:00"))).toBe(false);
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
