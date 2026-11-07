import { describe, it, expect } from "vitest";
import { isSameEvent, normalizeKey, venueKey } from "./dedupe";

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

// The venue half of the rule. `normalizeKey` answers what a string compares as;
// this answers whether the string names a venue in the first place, which is
// the question the guard in isSameEvent needs and the question the empty-string
// check only half answered.
describe("venueKey", () => {
  it("compares a real venue the way normalizeKey does", () => {
    expect(venueKey("  Doolally   Taproom ")).toBe("doolally taproom");
  });

  it("answers empty for a value that names no venue", () => {
    expect(venueKey("")).toBe("");
    expect(venueKey("   ")).toBe("");
    expect(venueKey(null)).toBe("");
    expect(venueKey(undefined)).toBe("");
  });

  // The placeholders the extractor leaves behind. These are stored verbatim,
  // because ingestion rejects only the empty string, and the public card
  // already renders every one of them as "Venue not named".
  it("answers empty for the placeholders the extractor writes", () => {
    expect(venueKey("undefined")).toBe("");
    expect(venueKey("null")).toBe("");
    expect(venueKey("string")).toBe("");
    expect(venueKey("N/A")).toBe("");
    expect(venueKey("  Undefined  ")).toBe("");
    expect(venueKey("-")).toBe("");
  });

  // Only the whole value is a placeholder. A venue whose name happens to
  // contain one of those words is a venue.
  it("keeps a real name that merely contains a placeholder word", () => {
    expect(venueKey("The String Bar")).toBe("the string bar");
    expect(venueKey("Null Cafe")).toBe("null cafe");
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
  // The separator is one of those spellings. A page writing "2026-03-15 18:30"
  // and one writing "2026-03-15T18:30:00+05:30" name the same 6:30 pm, and
  // until the parser read the spaced form as a moment the pair fell through to
  // the text comparison and became two cards in the queue describing one
  // screening.
  it("matches the same moment written with a space instead of a T", () => {
    const spaced = at("Doolally Taproom", "2026-03-15 18:30");
    expect(isSameEvent(spaced, at("Doolally Taproom", "2026-03-15T18:30:00+05:30"))).toBe(true);
    expect(isSameEvent(spaced, at("Doolally Taproom", "2026-03-15T18:30"))).toBe(true);
  });

  it("still separates a spaced value from a different moment", () => {
    const spaced = at("Doolally Taproom", "2026-03-15 18:30");
    expect(isSameEvent(spaced, at("Doolally Taproom", "2026-03-15T19:30"))).toBe(false);
    expect(isSameEvent(spaced, at("Doolally Taproom", "2026-03-15"))).toBe(false);
  });

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

  // Two source pages describing one screening rarely spell its time the same
  // way, and a twelve hour reading is the spelling a listings page uses. It
  // compared as text against the ISO spelling, so one 6:30 pm screening reached
  // the review queue as two cards that render identically and that a reviewer
  // had no way to tell apart.
  it("matches one moment written as a twelve hour reading and as ISO", () => {
    expect(
      isSameEvent(
        at("Doolally Taproom", "2026-03-15 6:30 pm"),
        at("Doolally Taproom", "2026-03-15T18:30:00+05:30")
      )
    ).toBe(true);
  });

  // The widening only ever reaches pairs naming the identical wall clock
  // moment. A marker the clock cannot carry still states no readable time, so
  // it falls back to the text it always had rather than matching a real one.
  it("still separates a twelve hour reading from a different moment", () => {
    expect(
      isSameEvent(
        at("Doolally Taproom", "2026-03-15 6:30 pm"),
        at("Doolally Taproom", "2026-03-15 7:30 pm")
      )
    ).toBe(false);
    expect(
      isSameEvent(
        at("Doolally Taproom", "2026-03-15 13:30 pm"),
        at("Doolally Taproom", "2026-03-15T13:30")
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

  // The same failure reached through the other spelling of "no venue name".
  // Ingestion rejects only the empty string, so an extraction that could not
  // read a venue is stored holding the literal "undefined" or "string", and on
  // the text comparison those were a venue and equal to each other. Two
  // unrelated screenings extracted from two pages, neither naming a venue the
  // model could read, were therefore a duplicate pair, and the second was
  // dropped by ingestion before it ever reached the review queue. Nothing in
  // the queue showed that it had happened, because the row was never written.
  it("never matches an extraction whose venue is a placeholder", () => {
    expect(isSameEvent(at("undefined", ""), at("undefined", ""))).toBe(false);
    expect(isSameEvent(at("string", "2026-03-15T18:30"), at("string", "2026-03-15T18:30"))).toBe(false);
    expect(isSameEvent(at("N/A", "2026-03-15T18:30"), at("n/a", "2026-03-15T18:30"))).toBe(false);
    expect(isSameEvent(at("  Undefined  ", ""), at("undefined", ""))).toBe(false);
  });

  it("never matches a placeholder venue against a real one", () => {
    const stated = at("Doolally Taproom", "2026-03-15T18:30");
    expect(isSameEvent(at("undefined", "2026-03-15T18:30"), stated)).toBe(false);
    expect(isSameEvent(stated, at("undefined", "2026-03-15T18:30"))).toBe(false);
  });

  // The narrowing does not reach a venue that merely reads like a placeholder.
  // A real duplicate still has to be caught, which is the point of the rule.
  it("still matches two extractions of a venue whose name contains a placeholder word", () => {
    expect(
      isSameEvent(
        at("The String Bar", "2026-03-15T18:30:00+05:30"),
        at("the string  BAR", "2026-03-15T18:30")
      )
    ).toBe(true);
  });
});
