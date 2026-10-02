// Duplicate detection for ingested candidates.
//
// The matching rule is kept separate from the database access on purpose: the
// rule is where the bugs live and it is pure, so it can be tested without a
// database. `isDuplicate` in scripts/ingest.ts does the I/O and calls this.
//
// The time half of the rule compares instants, not the text the instants were
// written in. It used to compare the text, which is the one column the repo
// documents as not comparable: `startTimeIST` keeps whatever the model wrote
// and `startsAt` is the instant, and the prompt asks only for a "best effort
// ISO 8601 string". The same 6:30 pm therefore arrives from two source pages
// as "2026-03-15T18:30:00+05:30" and as "2026-03-15T18:30", and on text those
// are two different events. Both parse to the same instant and both render as
// "Sun, 15 Mar · 6:30 pm", so the review queue showed two cards a reviewer had
// no way to tell apart, and approving both published the same screening twice
// on a page whose whole claim is that it is the one place to look.

import { parseISTClockInstant } from "./format";

export function normalizeKey(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type EventKey = {
  venueName: string;
  startTimeIST: string;
};

/**
 * Two extractions describe the same event when they name the same venue at the
 * same time. The venue is compared on normalized text, because the same venue
 * arrives from different sources as "Doolally Taproom", "doolally taproom" and
 * "Doolally  Taproom". The time is compared as an instant, because the same
 * moment arrives written several different legal ways; see `isSameStartTime`.
 *
 * Callers narrow by session before comparing, so session is not checked here.
 *
 * An extraction with no venue name matches nothing. Treating empty as equal
 * would collapse every unnamed row into a single duplicate and silently drop
 * real events whose venue the model failed to read.
 */
export function isSameEvent(a: EventKey, b: EventKey): boolean {
  const venue = normalizeKey(a.venueName);
  if (!venue) return false;
  if (venue !== normalizeKey(b.venueName)) return false;
  return isSameStartTime(a.startTimeIST, b.startTimeIST);
}

/**
 * Two start times are the same when they denote the same moment, and the text
 * they were written in is only consulted when at least one of them does not
 * denote a moment at all.
 *
 * Both sides have to carry a clock reading for the instants to be compared.
 * That is what stops this widening into a wrong answer: a value that is a date
 * alone means the page never printed a time, and reading it as an instant
 * would make it equal to a stated 05:30 IST. Those fall through to the text
 * comparison, which is exactly what they got before, so this can only ever
 * match more pairs that name the identical wall clock moment and never pairs
 * whose times were stated to different precision.
 */
function isSameStartTime(a: string, b: string): boolean {
  const ai = parseISTClockInstant(a);
  const bi = parseISTClockInstant(b);
  if (ai && bi) return ai.getTime() === bi.getTime();
  return normalizeKey(a) === normalizeKey(b);
}
