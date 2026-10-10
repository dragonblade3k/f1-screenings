// Display helpers shared by the public pages and the admin views, so a
// session or area renders identically everywhere instead of each page
// re-implementing its own label mapping.
//
// These are deliberately defensive. The ingestion step asks a local LLM to
// classify area and session into a fixed set, but the model does not always
// pick one: real rows in the database hold values like "MUMBAI|NAVI_MUMBAI"
// and "FP|QUALI|SPRINT|RACE|UNKNOWN" where it hedged across every option it
// considered. The durable fix belongs in ingestion (constrain decoding to a
// single enum value), but the read path should never render "Unknown" just
// because the writer was sloppy, so these collapse a multi value string down
// to one real value.

const AREAS = ["MUMBAI", "THANE", "NAVI_MUMBAI"] as const;

// Ordered most to least significant. A row that hedged across
// "FP|QUALI|SPRINT|RACE" is really telling us the venue shows the whole
// weekend, so the headline session is the one people care about: the race.
const SESSIONS_BY_SIGNIFICANCE = ["RACE", "SPRINT", "QUALI", "FP"] as const;

function parts(raw: string): string[] {
  return raw ? raw.split("|").map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
}

/** First value the model listed that is a known enum member. */
function firstListed(raw: string, allowed: readonly string[]): string | null {
  return parts(raw).find((p) => allowed.includes(p)) ?? null;
}

/** Highest ranked member present, regardless of the order the model listed them. */
function mostSignificant(raw: string, ranked: readonly string[]): string | null {
  const present = new Set(parts(raw));
  return ranked.find((r) => present.has(r)) ?? null;
}

/**
 * The place an area value names, or null when it names none.
 *
 * Separate from `areaLabel` because the two answers are for different
 * audiences. A reader looking at a row whose area never resolved is owed a
 * sentence saying so, which is what `areaLabel` returns. A caller that is
 * going to hand the value to something other than a reader is owed the
 * absence itself, because a sentence written for a reader is not a place.
 */
export function areaName(a: string): string | null {
  switch (firstListed(a, AREAS)) {
    case "MUMBAI": return "Mumbai";
    case "THANE": return "Thane";
    case "NAVI_MUMBAI": return "Navi Mumbai";
    default: return null;
  }
}

export function areaLabel(a: string): string {
  return areaName(a) ?? "Area unconfirmed";
}

export type SessionKind = "race" | "quali" | "sprint" | "fp" | "unknown";

export function sessionKind(s: string): SessionKind {
  switch (mostSignificant(s, SESSIONS_BY_SIGNIFICANCE)) {
    case "RACE": return "race";
    case "QUALI": return "quali";
    case "SPRINT": return "sprint";
    case "FP": return "fp";
    default: return "unknown";
  }
}

export function sessionLabel(s: string): string {
  switch (sessionKind(s)) {
    case "race": return "Race";
    case "quali": return "Qualifying";
    case "sprint": return "Sprint";
    case "fp": return "Practice";
    default: return "Session TBC";
  }
}

// Every screening listed here happens in Mumbai, Thane or Navi Mumbai, so
// every stored time means IST no matter where the process runs. Both the
// parsing and the rendering have to say so explicitly.
const IST = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

// A trailing Z or +/-HH:MM on an ISO 8601 timestamp.
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;
// A date and a wall clock reading, which is the form that has to be pinned.
// A date with no time is left alone: the spec reads it as UTC, and shifting
// it into IST moves it to 05:30 the same morning, which still prints the
// right day.
const HAS_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// ECMAScript reads a date-time carrying no offset as the runtime's local
// time, which on a UTC host is five and a half hours off from what the
// column name promises. Read it as the IST wall clock it is.
function toInstant(raw: string): Date {
  const s = raw.trim();
  return new Date(HAS_CLOCK.test(s) && !HAS_OFFSET.test(s) ? s + IST_OFFSET : s);
}

// startTimeIST is stored as a loose string (ISO preferred, but ingestion
// cannot guarantee it). Format when it parses, fall back to the raw text
// when it does not, rather than showing an "Invalid Date".
/**
 * The instant a loose startTimeIST string denotes, or null when it does not
 * parse. This is what fills the sortable `startsAt` column: the text column
 * keeps whatever the model wrote, and ordering uses this.
 */
export function parseISTInstant(raw: string | null | undefined): Date | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const d = toInstant(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * The instant a startTimeIST string denotes, but only when the string states a
 * time of day. Null otherwise, including for a value that is a date alone.
 *
 * This exists for comparison rather than for ordering or display, which is why
 * it is stricter than `parseISTInstant`. That one answers for every value it
 * can read, a bare date included, which it takes as UTC midnight and so as
 * 05:30 IST the same morning. That is the right answer for sorting, where a
 * day with no time still has to land on its own day. It is the wrong answer
 * for asking whether two extractions name the same moment: "2026-03-15" and
 * "2026-03-15T05:30" come out as the identical instant while meaning different
 * things, one a time nobody could read off the page and the other a time
 * somebody wrote down. Requiring a clock reading on both sides keeps those
 * apart, and leaves a comparison involving a bare date to fall back to the
 * text, which is all it ever had to go on.
 */
export function parseISTClockInstant(raw: string | null | undefined): Date | null {
  const s = (raw ?? "").trim();
  return HAS_CLOCK.test(s) ? parseISTInstant(s) : null;
}

// Ingestion writes whatever the extractor produced, and some rows carry the
// literal strings "undefined", "null", or the placeholder "string" where a
// field was missing. Render nothing rather than printing the word.
const JUNK = new Set(["undefined", "null", "none", "n/a", "na", "string", "-", "—"]);

export function clean(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  return JUNK.has(v.toLowerCase()) ? "" : v;
}

/**
 * The venue a row names, or null when it names none.
 *
 * Same split as `areaName` and `areaLabel`, and it exists for the same reason:
 * the two callers want different sentences. The public pages owe a visitor
 * something that reads as a listing with a missing name, the review queue owes
 * a reviewer something that says the extraction failed, and neither sentence is
 * the venue, so the helper answers with the absence and each page supplies its
 * own words.
 *
 * `venueName` is the one free text field on the card that was never cleaned.
 * Its EVENT_SCHEMA entry is a plain `type: "string"`, so unlike area and
 * session there is no enum for constrained decoding to enforce and the prompt's
 * instruction not to echo a placeholder is the only thing standing between the
 * model and the literal "undefined" or "string" in the heading. Invariant 1's
 * lesson is that such an instruction guarantees nothing. `scripts/ingest.ts`
 * rejects only the empty string, so the word is stored verbatim and the card
 * printed it as the name of the bar.
 */
export function venueName(raw: string | null | undefined): string | null {
  return clean(raw) || null;
}

/**
 * The day and time to print for a startTimeIST value, or null when the row
 * states no time and the page should say so itself.
 *
 * The raw value goes through `clean` first, which is what separates the two
 * kinds of unparseable string. Prose a human wrote, "Sunday evening", is a
 * real if imprecise claim about when the screening is, so it is echoed. A
 * placeholder the extractor left behind, "undefined" or the literal "string",
 * claims nothing, and echoing it printed the word itself as the date on the
 * public listing. Null is the right answer for those because both call sites
 * already handle it: the card omits the date line and the detail page prints
 * "To be confirmed".
 */
export function formatWhen(raw: string): { day: string; time: string } | null {
  const v = clean(raw);
  if (!v) return null;
  const d = parseISTInstant(v);
  if (!d) return { day: v, time: "" };
  return {
    day: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST }),
    // Only a value that stated a clock reading gets a time printed. The day
    // comes from `parseISTInstant`, which answers for a bare date by reading it
    // as UTC midnight, and that is the right answer for the day: 05:30 IST the
    // same morning still lands on the morning the page named. It is not an
    // answer about the time, and printing it rendered a row whose source said
    // only "2026-03-15" as "Sun, 15 Mar · 5:30 am", a start time nobody
    // wrote down and one no bar in Mumbai is showing a race at. The same held
    // for every other shape with no clock the spec recognises: a value the
    // runtime reads as host-local, "2026-03-15 18:30", printed 12:00 am. An
    // omitted time is the honest reading, and both call sites already drop the
    // time when it is empty, because prose with no instant takes this path too.
    time: parseISTClockInstant(v)
      ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST })
      : ""
  };
}

// Three outcomes, not two. A null price means nobody could read one off the
// source page, and saying "Free entry" about it is a claim the data does not
// support. `known` lets a caller style an unknown price differently from a
// genuinely free one. Still defensive per invariant 4: a negative cannot come
// from `normalizePriceINR` any more, but it is treated as unknown rather than
// free if one ever appears.
export function formatPrice(
  p: number | null | undefined
): { text: string; free: boolean; known: boolean } {
  if (p === null || p === undefined || !Number.isFinite(p) || p < 0) {
    return { text: "Price not listed", free: false, known: false };
  }
  if (p === 0) return { text: "Free entry", free: true, known: true };
  return { text: `₹${p.toLocaleString("en-IN")}`, free: false, known: true };
}

/**
 * The search text for a maps link to a venue, or null when the row names
 * nowhere to look and the page should omit the link rather than open a map of
 * nothing in particular.
 *
 * Every part of this string is a claim about where the venue is, so every part
 * has to be one the row actually made. `areaLabel` is the right source for the
 * page body and the wrong one here: its fallback, "Area unconfirmed", is a
 * sentence written for a reader, and sending it as search text asks the maps
 * provider to find a venue in a place that does not exist, which pushes the
 * real venue down the results it does return. `areaName` answers null instead,
 * so an unresolved area contributes nothing at all.
 *
 * The venue name goes through `venueName` and the address through `clean` for
 * the same reason. The address already did at the one call site, but the venue
 * name did not, so a row holding the literal "string" where the venue belongs
 * searched for that word. Dropping empty parts rather than joining them also
 * keeps a missing address from leaving a gap in the middle of the query.
 */
export function mapsQuery(
  venue: string | null | undefined,
  address: string | null | undefined,
  area: string | null | undefined
): string | null {
  const stated = [venueName(venue) ?? "", clean(address), areaName(area ?? "") ?? ""];
  const q = stated.filter(Boolean).join(" ");
  return q || null;
}

// Links are the one extracted field with no protection at all. `bookingUrl` is
// whatever the model read off the page and its EVENT_SCHEMA entry is a plain
// `type: "string"`, so constraining decoding buys nothing here the way an enum
// does for area and session. A value only has to be non-empty for a page to
// render a link, and three kinds of non-address arrive often enough to matter:
// the placeholders the JUNK set above already knows about, prose like "TBD",
// and a real address written without its scheme, "www.doolally.in/book". The
// last one is not an absolute URL, so a browser resolves it against the page it
// is on and a booking button lands on /events/<id>/www.doolally.in/book. A
// `javascript:` value would be absolute and would run in this site's origin.
//
// A host has at least one dot, which is what separates an address from a word.
const LINKABLE_HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function asHttpUrl(candidate: string): string | null {
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  return LINKABLE_HOST.test(u.hostname) ? u.href : null;
}

/**
 * The href to render for an extracted link, or null when there is nothing worth
 * linking to, in which case the page should omit the link entirely rather than
 * render a button that goes nowhere.
 *
 * Only http and https survive. A value carrying any other scheme is rejected
 * outright instead of being rewritten, because a `javascript:` or `data:` href
 * is the model handing the page something to execute, not an address.
 *
 * A scheme-less host is upgraded to https. That is the one guess made here, and
 * it is made because the intent is unambiguous: "www.doolally.in/book" is an
 * address whose scheme the page never printed. Prose is not, so anything with
 * whitespace, and anything whose host is a bare word with no dot, is dropped.
 */
export function externalUrl(raw: string | null | undefined): string | null {
  const v = clean(raw);
  if (!v || /\s/.test(v)) return null;
  return HAS_SCHEME.test(v) ? asHttpUrl(v) : asHttpUrl("https://" + v);
}
