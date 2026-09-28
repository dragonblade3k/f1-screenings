// The price rule, kept here rather than at the three places that need it.
//
// `priceINR` is an `Int` column, and until this existed every writer built its
// own number for it. Ingestion used `Number.isFinite(Number(e.priceINR)) ?
// Number(e.priceINR) : 0`, which lets a float and a negative straight through:
// `Number.isFinite(499.5)` is true, so a price with paise on it reaches a
// column that cannot hold one, and Prisma refuses the row. That refusal lands
// inside the per-URL try block in `scripts/ingest.ts` that wraps the whole
// events loop, so it does not skip the one bad event, it abandons every
// remaining event extracted from that page and writes nothing, which leaves
// the page un-ingested and walks into it again on the next run. It is the same
// failure shape the confidence fix removed.
//
// The admin routes had their own copy, `parseInt(v, 10)` with a NaN fallback,
// duplicated character for character in `update-and-approve` and
// `manual-create`. `parseInt` reads a prefix and stops, so a reviewer typing
// the price the way it is written in India, "1,500", got 1: the public page
// then advertised a fifteen hundred rupee screening at one rupee. "₹1500" did
// not parse at all and became 0, and 0 renders as "Free entry".
//
// Every one of those failures is silent on a public page, which is why the
// rule is one function with its own tests rather than an expression at each
// call site.

// Prisma's `Int` is a 32-bit signed integer whatever SQLite would store, so a
// value past this cannot be written even though it parses.
const MAX_INT32 = 2 ** 31 - 1;

// Formatting, not value: a single currency marker on either side, and commas
// grouping the digits. The match is anchored, so unlike `parseInt` this cannot
// read a number out of the front of a sentence and discard the rest.
const PRICE_TEXT =
  /^(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:₹|rs\.?|inr)?$/i;

/**
 * The rupee price to store, or 0 when there is no usable number.
 *
 * A value counts when it reads as a single non-negative number that the column
 * can hold. A fraction is rounded to the nearest rupee, because the alternative
 * is 0 and 0 does not mean "unknown" on the public page, it renders as "Free
 * entry": turning ₹499.50 into "Free entry" is a worse answer than ₹500, and
 * rounding restores a unit the column cannot carry rather than inventing a
 * judgement the writer never made.
 *
 * Everything else is 0. A negative price has no correct reading, a boolean is
 * not a price however readily `Number` turns it into 1, and prose is not a
 * price. Note that 0 is where both "free" and "we could not tell" land, which
 * the schema comment has always conflated; see the note in CLAUDE.md.
 */
export function normalizePriceINR(raw: unknown): number {
  if (typeof raw === "number") return fromNumber(raw);
  if (typeof raw !== "string") return 0;

  const m = PRICE_TEXT.exec(raw.trim());
  return m ? fromNumber(Number(m[1].replace(/,/g, ""))) : 0;
}

function fromNumber(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  const rupees = Math.round(n);
  return rupees > MAX_INT32 ? 0 : rupees;
}
