import { describe, it, expect } from "vitest";
import {
  areaLabel,
  sessionKind,
  sessionLabel,
  formatWhen,
  clean,
  formatPrice,
  parseISTInstant,
  parseISTClockInstant,
  externalUrl,
  areaName,
  mapsQuery
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

describe("areaName", () => {
  it("resolves the same values areaLabel does", () => {
    expect(areaName("MUMBAI")).toBe("Mumbai");
    expect(areaName("NAVI_MUMBAI")).toBe("Navi Mumbai");
    expect(areaName("UNKNOWN|THANE")).toBe("Thane");
  });

  // The whole reason it is separate: areaLabel owes a reader a sentence, this
  // owes a caller the absence, and a caller that is not a reader must not be
  // handed the sentence.
  it("is null where areaLabel says 'Area unconfirmed'", () => {
    for (const v of ["", "UNKNOWN", "PUNE", "FP|QUALI"]) {
      expect(areaLabel(v)).toBe("Area unconfirmed");
      expect(areaName(v)).toBeNull();
    }
  });
});

describe("mapsQuery", () => {
  it("joins the parts of a clean row", () => {
    expect(mapsQuery("Doolally Taproom", "Shop 5, Kamala Mills, Lower Parel", "MUMBAI"))
      .toBe("Doolally Taproom Shop 5, Kamala Mills, Lower Parel Mumbai");
  });

  // The bug this helper was extracted for. The detail page built the query as
  // `${venueName} ${address} ${areaLabel(area)}`, so a row whose area never
  // resolved sent the words "Area unconfirmed" to the maps provider as part of
  // the search text and pushed the real venue down the results.
  it("contributes nothing for an area that did not resolve", () => {
    const q = mapsQuery("Doolally Taproom", "Shop 5, Kamala Mills, Lower Parel", "UNKNOWN");
    expect(q).toBe("Doolally Taproom Shop 5, Kamala Mills, Lower Parel");
    expect(q).not.toContain("unconfirmed");
  });

  it("drops a placeholder venue name rather than searching for the word", () => {
    expect(mapsQuery("string", "Shop 5, Kamala Mills", "MUMBAI")).toBe("Shop 5, Kamala Mills Mumbai");
    expect(mapsQuery("undefined", "Shop 5, Kamala Mills", "THANE")).toBe("Shop 5, Kamala Mills Thane");
  });

  it("drops a placeholder address, leaving no gap in the middle", () => {
    expect(mapsQuery("Doolally Taproom", "undefined", "MUMBAI")).toBe("Doolally Taproom Mumbai");
    expect(mapsQuery("Doolally Taproom", "", "MUMBAI")).toBe("Doolally Taproom Mumbai");
    expect(mapsQuery("Doolally Taproom", null, "MUMBAI")).toBe("Doolally Taproom Mumbai");
  });

  // Null rather than an empty search, so the page can omit the button. The
  // same call the booking link already makes: a button that goes nowhere
  // useful is worse than no button.
  it("is null when no part of the row names a place", () => {
    expect(mapsQuery("string", "null", "null")).toBeNull();
    expect(mapsQuery("", "", "")).toBeNull();
    expect(mapsQuery(null, undefined, undefined)).toBeNull();
  });

  it("still answers when the venue name is all the row has", () => {
    expect(mapsQuery("Doolally Taproom", "undefined", "UNKNOWN")).toBe("Doolally Taproom");
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

  // A placeholder is not a claim about when the screening is, and echoing one
  // printed the word itself where the date belongs: a card on the public
  // listing read "undefined" and the detail page said the screening was on
  // "string". Null is what both call sites already know how to render.
  it("reports a placeholder as no time rather than printing the word", () => {
    for (const v of ["undefined", "null", "none", "n/a", "NA", "string", "-", "\u2014"]) {
      expect(formatWhen(v)).toBeNull();
    }
  });

  it("sees a padded placeholder as a placeholder", () => {
    expect(formatWhen("  undefined  ")).toBeNull();
    expect(formatWhen("   ")).toBeNull();
  });

  it("trims the text it echoes", () => {
    expect(formatWhen("  Sunday evening  ")).toEqual({ day: "Sunday evening", time: "" });
  });

  it("still parses a value carrying surrounding whitespace", () => {
    expect(formatWhen("  2026-03-15T18:30  ")).toEqual(
      formatWhen("2026-03-15T18:30")
    );
  });

  // A date with no time is a real claim about the day and no claim at all
  // about the hour. It reached the public listing as one anyway: the instant
  // behind a bare date is UTC midnight, which is 05:30 IST, so a card whose
  // source page printed only "2026-03-15" advertised the screening at
  // "Sun, 15 Mar · 5:30 am".
  it("prints the day but no time for a date that states no clock", () => {
    expect(inZone("UTC", "2026-03-15")).toEqual({ day: "Sun, 15 Mar", time: "" });
  });

  it("keeps the day of a bare date out of the server's zone", () => {
    for (const tz of ["UTC", "Asia/Kolkata", "America/New_York"]) {
      expect(inZone(tz, "2026-03-15")).toEqual({ day: "Sun, 15 Mar", time: "" });
    }
  });

  // Not only the ISO form. Every shape the spec reads without a clock landed
  // on a fabricated time: a non-ISO date-time is read as the runtime's local
  // zone, which on the UTC host printed 12:00 am.
  it("prints no time for any value that never stated one", () => {
    for (const v of ["2026-03-15", "March 15, 2026", "2026-03-15 18:30"]) {
      expect(inZone("UTC", v)!.time).toBe("");
    }
  });

  // The guard is the stated clock reading, not the hour it happens to be, so
  // a screening really at 05:30 still prints its time.
  it("still prints a stated time that equals the bare-date instant", () => {
    const r = inZone("UTC", "2026-03-15T05:30");
    expect(r!.day).toBe("Sun, 15 Mar");
    expect(r!.time).toContain("5:30");
  });
});

describe("formatPrice", () => {
  it("treats zero as free entry", () => {
    expect(formatPrice(0)).toEqual({ text: "Free entry", free: true, known: true });
  });

  it("reports an absent price as not listed, never as free", () => {
    // These used to all render "Free entry", which claimed something about a
    // real venue that the data never said.
    for (const v of [null, undefined, -1, NaN]) {
      const r = formatPrice(v as any);
      expect(r.free).toBe(false);
      expect(r.known).toBe(false);
      expect(r.text).toBe("Price not listed");
    }
  });

  it("formats a real price in rupees", () => {
    const r = formatPrice(1500);
    expect(r.free).toBe(false);
    expect(r.text).toContain("₹");
    expect(r.text).toContain("1,500");
  });
});

describe("externalUrl", () => {
  it("passes a real http or https address through", () => {
    expect(externalUrl("https://www.zomato.com/mumbai/book")).toBe("https://www.zomato.com/mumbai/book");
    expect(externalUrl("http://doolally.in/f1")).toBe("http://doolally.in/f1");
  });

  it("supplies the scheme the page never printed", () => {
    expect(externalUrl("www.doolally.in/book")).toBe("https://www.doolally.in/book");
    expect(externalUrl("doolally.in")).toBe("https://doolally.in/");
  });

  it("drops the placeholders the extractor writes for a missing field", () => {
    expect(externalUrl("string")).toBeNull();
    expect(externalUrl("undefined")).toBeNull();
    expect(externalUrl("n/a")).toBeNull();
    expect(externalUrl("")).toBeNull();
    expect(externalUrl(null)).toBeNull();
  });

  it("drops prose, which would otherwise resolve against the current page", () => {
    expect(externalUrl("TBD")).toBeNull();
    expect(externalUrl("Call 98765 43210 to book")).toBeNull();
    expect(externalUrl("walk-ins")).toBeNull();
  });

  it("rejects any scheme other than http and https", () => {
    expect(externalUrl("javascript:alert(document.cookie)")).toBeNull();
    expect(externalUrl("data:text/html,<script>1</script>")).toBeNull();
    expect(externalUrl("mailto:bookings@doolally.in")).toBeNull();
    expect(externalUrl("ftp://doolally.in/menu")).toBeNull();
  });

  it("never returns a value a browser would read as relative", () => {
    const inputs = [
      "https://www.zomato.com/book", "www.doolally.in/book", "doolally.in",
      "string", "TBD", "javascript:alert(1)", "/admin/inbox", "book/now", ""
    ];
    for (const raw of inputs) {
      const href = externalUrl(raw);
      if (href !== null) expect(href).toMatch(/^https?:\/\/[^/]+\./);
    }
  });
});

describe("parseISTInstant", () => {
  it("reads a bare date-time as the IST wall clock it claims to be", () => {
    const d = parseISTInstant("2026-03-15T20:00");
    expect(d).not.toBeNull();
    // 20:00 IST is 14:30 UTC.
    expect(d!.toISOString()).toBe("2026-03-15T14:30:00.000Z");
  });

  it("respects an explicit offset instead of re-pinning it", () => {
    const d = parseISTInstant("2026-03-15T20:00:00Z");
    expect(d!.toISOString()).toBe("2026-03-15T20:00:00.000Z");
  });

  it("is null for the free text the column also holds", () => {
    for (const v of ["", "   ", "Sunday evening", "TBD", null, undefined]) {
      expect(parseISTInstant(v as any)).toBeNull();
    }
  });

  it("orders correctly across the formats the old string sort got wrong", () => {
    // Lexicographically "8 PM" sorts before "2026-...", which is why the
    // listing needed a real instant to order on.
    const a = parseISTInstant("2026-03-15T20:00")!;
    const b = parseISTInstant("2026-03-16T09:00")!;
    expect(a.getTime()).toBeLessThan(b.getTime());
  });
});

describe("parseISTClockInstant", () => {
  it("agrees with parseISTInstant whenever a time of day is stated", () => {
    for (const v of ["2026-03-15T20:00", "2026-03-15T20:00:00", "2026-03-15T20:00:00+05:30", "2026-03-15T20:00:00Z"]) {
      expect(parseISTClockInstant(v)!.getTime()).toBe(parseISTInstant(v)!.getTime());
    }
  });

  it("is null for a date with no time, which parseISTInstant still answers for", () => {
    expect(parseISTInstant("2026-03-15")).not.toBeNull();
    expect(parseISTClockInstant("2026-03-15")).toBeNull();
  });

  // The whole reason this is separate from parseISTInstant: ordering wants an
  // answer for a bare date, comparison must not have one, because the answer
  // collides with a real 05:30 IST.
  it("declines the collision that makes a bare date unusable for comparison", () => {
    expect(parseISTInstant("2026-03-15")!.getTime()).toBe(parseISTInstant("2026-03-15T05:30")!.getTime());
    expect(parseISTClockInstant("2026-03-15")).toBeNull();
    expect(parseISTClockInstant("2026-03-15T05:30")).not.toBeNull();
  });

  it("is null for the free text and the absent values the column also holds", () => {
    for (const v of ["", "   ", "Sunday evening", "TBD", "8 PM Sunday", null, undefined]) {
      expect(parseISTClockInstant(v as any)).toBeNull();
    }
  });
});
