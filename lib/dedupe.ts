// Duplicate detection for ingested candidates.
//
// The matching rule is kept separate from the database access on purpose: the
// rule is where the bugs live and it is pure, so it can be tested without a
// database. `isDuplicate` in scripts/ingest.ts does the I/O and calls this.

export function normalizeKey(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type EventKey = {
  venueName: string;
  startTimeIST: string;
};

/**
 * Two extractions describe the same event when they name the same venue at the
 * same time. Compared on normalized text, because the same venue arrives from
 * different sources as "Doolally Taproom", "doolally taproom" and
 * "Doolally  Taproom".
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
  return normalizeKey(a.startTimeIST) === normalizeKey(b.startTimeIST);
}
