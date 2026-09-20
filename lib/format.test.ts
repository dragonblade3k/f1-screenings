import { describe, it, expect } from "vitest";
import {
  areaLabel,
  sessionKind,
  sessionLabel,
  formatWhen,
  clean,
  formatPrice
} from "./format";

// These helpers exist because early ingest runs, before decoding was
// constrained to a JSON schema, wrote hedged and placeholder values straight
// into the database. Those rows are still there. The cases below are taken
// from real stored values, so the tests double as a record of what the read
// path has to survive.

describe("areaLabel", () => {
  it("labels a clean value", () => {
    expect(areaLabel("MUMBAI")).toBe("Mumbai");
    expect(areaLabel("NAVI_MUMBAI")).toBe("Navi Mumbai");
  });

  it("takes the first listed value when the model hedged", () => {
    expect(areaLabel("MUMBAI|NAVI_MUMBAI")).toBe("Mumbai");
    expect(areaLabel("THANE|MUMBAI")).toBe("Thane");
  });

  it("skips leading junk to reach a real member", () => {
    expect(areaLabel("UNKNOWN|THANE")).toBe("Thane");
  });

  it("falls back when nothing is recognisable", () => {
    expect(areaLabel("")).toBe("Area unconfirmed");
    expect(areaLabel("UNKNOWN")).toBe("Area unconfirmed");
    expect(areaLabel("PUNE")).toBe("Area unconfirmed");
  });

  it("is insensitive to case and padding", () => {
    expect(areaLabel(" mumbai ")).toBe("Mumbai");
    expect(areaLabel("thane | mumbai")).toBe("Thane");
  });
});

describe("sessionKind", () => {
  it("reads a clean value", () => {
    expect(sessionKind("RACE")).toBe("race");
    expect(sessionKind("FP")).toBe("fp");
  });

  // The ranking rule, and the reason this is not the same function as
  // areaLabel: a venue that hedged across the whole weekend is really saying
  // it shows the race, whatever order the model happened to list things in.
  it("picks the most significant session, not the first listed", () => {
    expect(sessionKind("FP|QUALI|SPRINT|RACE|UNKNOWN")).toBe("race");
    expect(sessionKind("FP|QUALI")).toBe("quali");
    expect(sessionKind("FP|SPRINT")).toBe("sprint");
  });

  it("ignores list order entirely", () => {
    expect(sessionKind("RACE|FP")).toBe("race");
    expect(sessionKind("FP|RACE")).toBe("race");
  });

  it("falls back when nothing is recognisable", () => {
    expect(sessionKind("")).toBe("unknown");
    expect(sessionKind("UNKNOWN")).toBe("unknown");
  });
});

describe("sessionLabel", () => {
  it("maps kinds to display text", () => {
    expect(sessionLabel("RACE")).toBe("Race");
    expect(sessionLabel("QUALI")).toBe("Qualifying");
    expect(sessionLabel("FP")).toBe("Practice");
    expect(sessionLabel("")).toBe("Session TBC");
  });

  it("labels a hedged weekend as the race", () => {
    expect(sessionLabel("FP|QUALI|SPRINT|RACE")).toBe("Race");
  });
});

describe("clean", () => {
  it("passes real values through untouched", () => {
    expect(clean("Bandra")).toBe("Bandra");
    expect(clean("  Powai  ")).toBe("Powai");
  });

  // "string" is the placeholder the model copied out of the prompt's sample
  // object; "undefined" is what a missing field serialised to.
  it("strips placeholders the extractor emitted as literal text", () => {
    expect(clean("string")).toBe("");
    expect(clean("undefined")).toBe("");
    expect(clean("null")).toBe("");
    expect(clean("N/A")).toBe("");
  });

  it("strips them regardless of case or padding", () => {
    expect(clean(" String ")).toBe("");
    expect(clean("UNDEFINED")).toBe("");
  });

  it("handles absent values", () => {
    expect(clean(null)).toBe("");
    expect(clean(undefined)).toBe("");
    expect(clean("")).toBe("");
  });

  it("does not strip a real value that merely contains a junk word", () => {
    expect(clean("Null Cafe")).toBe("Null Cafe");
  });
});

describe("formatWhen", () => {
  // Every case below is rendered in IST on purpose. These listings are for
  // Mumbai, Thane and Navi Mumbai, and DEPLOY.md puts the app on Vercel,
  // which runs UTC. Reading the runtime zone instead of IST is how a
  // screening ends up advertised on the wrong evening.
  const inZone = (tz: string, raw: string) => {
    const before = process.env.TZ;
    process.env.TZ = tz;
    try {
      return formatWhen(raw);
    } finally {
      process.env.TZ = before;
    }
  };

  it("returns null when there is no time at all", () => {
    expect(formatWhen("")).toBeNull();
  });

  it("splits a parseable timestamp into day and time", () => {
    const r = formatWhen("2026-03-15T18:30:00+05:30");
    expect(r).not.toBeNull();
    expect(r!.day).not.toBe("");
    expect(r!.time).not.toBe("");
  });

  it("renders the IST wall clock, not the server's", () => {
    const r = inZone("UTC", "2026-03-08T22:30:00+05:30");
    expect(r!.day).toContain("8 Mar");
    expect(r!.time).toContain("10:30");
  });

  // The case that motivated pinning the zone. A screening just after
  // midnight IST is five and a half hours earlier in UTC, which lands on the
  // previous calendar day: this rendered as Saturday evening on a deployed
  // server while showing correctly on a laptop in India.
  it("keeps a past-midnight screening on its own day", () => {
    const r = inZone("UTC", "2026-03-15T00:30:00+05:30");
    expect(r!.day).toContain("15 Mar");
    expect(r!.day).toContain("Sun");
    expect(r!.time).toContain("12:30");
  });

  // startTimeIST without an offset still means IST. ECMAScript would read it
  // as the runtime's local time, so it needs the offset supplied.
  it("reads an offsetless timestamp as IST rather than server local", () => {
    const r = inZone("UTC", "2026-03-15T18:30:00");
    expect(r!.day).toContain("15 Mar");
    expect(r!.time).toContain("6:30");
  });

  it("gives the same answer whatever zone the process runs in", () => {
    for (const raw of [
      "2026-03-08T22:30:00+05:30",
      "2026-03-15T00:30:00+05:30",
      "2026-03-15T18:30:00",
      "2026-03-15T13:00:00Z"
    ]) {
      const ist = inZone("Asia/Kolkata", raw);
      expect(inZone("UTC", raw)).toEqual(ist);
      expect(inZone("America/New_York", raw)).toEqual(ist);
    }
  });

  it("echoes unparseable text instead of rendering Invalid Date", () => {
    const r = formatWhen("Sunday evening");
    expect(r).toEqual({ day: "Sunday evening", time: "" });
  });
});

describe("formatPrice", () => {
  it("treats zero and missing as free entry", () => {
    expect(formatPrice(0)).toEqual({ text: "Free entry", free: true });
    expect(formatPrice(-1).free).toBe(true);
  });

  it("formats a real price in rupees", () => {
    const r = formatPrice(1500);
    expect(r.free).toBe(false);
    expect(r.text).toContain("₹");
    expect(r.text).toContain("1,500");
  });
});
