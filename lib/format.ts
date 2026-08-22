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

export function areaLabel(a: string): string {
  switch (firstListed(a, AREAS)) {
    case "MUMBAI": return "Mumbai";
    case "THANE": return "Thane";
    case "NAVI_MUMBAI": return "Navi Mumbai";
    default: return "Area unconfirmed";
  }
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

// startTimeIST is stored as a loose string (ISO preferred, but ingestion
// cannot guarantee it). Format when it parses, fall back to the raw text
// when it does not, rather than showing an "Invalid Date".
export function formatWhen(raw: string): { day: string; time: string } | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { day: raw, time: "" };
  return {
    day: d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
  };
}

// Ingestion writes whatever the extractor produced, and some rows carry the
// literal strings "undefined", "null", or the placeholder "string" where a
// field was missing. Render nothing rather than printing the word.
const JUNK = new Set(["undefined", "null", "none", "n/a", "na", "string", "-", "—"]);

export function clean(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  return JUNK.has(v.toLowerCase()) ? "" : v;
}

export function formatPrice(p: number): { text: string; free: boolean } {
  if (!p || p <= 0) return { text: "Free entry", free: true };
  return { text: `₹${p.toLocaleString("en-IN")}`, free: false };
}
