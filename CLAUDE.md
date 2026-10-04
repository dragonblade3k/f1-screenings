# Working in this repo

Context for Claude Code sessions. See [README.md](./README.md) for what the
project is and why it is built this way.

## Invariants — do not regress these

1. **Extraction decoding is schema-constrained.** `scripts/ingest.ts` passes
   `EVENT_SCHEMA` from `lib/extraction.ts` (a real JSON Schema, with `enum`
   arrays) as Ollama's `format`.
   Do **not** change this back to `format: "json"` and describe the shape in the
   prompt. That was the original implementation and it produced malformed values
   in 73% of rows: `"MUMBAI|NAVI_MUMBAI"`, the literal string `"string"`,
   `"undefined"`. `format: "json"` guarantees the output parses, not that the
   values are legal. If a field needs a fixed set of values, put an `enum` in
   `EVENT_SCHEMA`. `lib/extraction.test.ts` pins this.

2. **Nothing reaches the public pages without human approval.** Ingestion writes
   `Candidate` rows only. `Event` rows are created solely by the approve
   handlers. Public pages read `Event` and must never query `Candidate`.

3. **Approval is atomic.** `api/admin/approve` and `update-and-approve` wrap the
   status update and the `Event` insert in `prisma.$transaction`. Keep it.

4. **Display formatting lives in `lib/format.ts`.** Pages must not re-implement
   area or session labels locally. The helpers there are intentionally defensive
   about malformed values because pre-fix rows are still in the database.

5. **The public deployment serves read paths only.** `PUBLIC_ONLY=1` is set in
   the hosted environment. `requireAdmin` refuses with 404 when it is set, and
   the three `/admin` pages call `notFound()`. This is not cosmetic: those pages
   are server components that query Prisma and render candidate rows, and only
   the `api/admin` routes ever checked a token, so without the gate anyone
   visiting `/admin/inbox` on the public URL could read the whole unreviewed
   queue including every page's `rawText`. Ingestion needs SerpAPI and a local
   Ollama and curation needs a human, so neither was ever going to run there.

## Layout

```
app/
  page.tsx                       public: verified Events, grouped by area
  events/[id]/page.tsx           public: single event
  layout.tsx                     root layout
  admin/inbox/page.tsx           review queue for PENDING candidates
  admin/edit/[id]/page.tsx       correct fields before approving
  admin/manual/page.tsx          create an Event without a Candidate
  admin/AdminHeaderInjector.tsx  attaches the admin token to forms client-side
  api/admin/
    approve/route.ts             Candidate -> VERIFIED + create Event
    update-and-approve/route.ts  edit fields, then the same
    reject/route.ts              PENDING Candidate -> REJECTED, row kept
    manual-create/route.ts       create an Event directly
    _token.ts                    token constant
lib/
  format.ts                      display helpers, defensive (see invariant 4)
  dedupe.ts                      isSameEvent, the pure duplicate rule
  confidence.ts                  normalizeConfidence, the pure score rule
  deployment.ts                  isPublicOnly(), which surfaces this process serves
  extraction.ts                  EVENT_SCHEMA and the prompt, the model contract
  price.ts                       normalizePriceINR, the pure rupee rule
  admin.ts                       requireAdmin(req)
  prisma.ts                      client singleton
scripts/
  ingest.ts                      SerpAPI -> fetch -> Cheerio -> Ollama -> Candidate
prisma/
  schema.prisma                  Candidate and Event
```

## Conventions

- **Status and enum fields are plain strings**, not TypeScript enums. This began
  as a SQLite limitation and is now a deliberate choice: the values cross a model
  boundary, and a Postgres native enum would mean a migration every time the
  extractor learns a new session type. Legal values are documented as comments in
  `schema.prisma` and enforced by the `enum` arrays in `EVENT_SCHEMA`.
- **Env-first config.** No hardcoded service URLs beyond defaults in
  `ingest.ts`. See `.env.example`.
- **Postgres everywhere.** The datasource is `postgresql` for local development
  and for the deployment, against the same hosted database. SQLite was dropped
  when the app was deployed: keeping two providers meant the migration history
  could only ever be correct for one of them.
- **`priceINR` is nullable and `null` is not `0`.** `null` means no readable
  price, `0` means free. `formatPrice` renders those as "Price not listed" and
  "Free entry" and must keep them distinct. Every write path has to keep them
  distinct too: the extraction prompt asks for an omitted `priceINR` rather
  than a 0 when a page states no price, and the manual form leaves the field
  empty rather than pre-filling 0. Both said 0 until the column stopped being
  able to.
- **`startTimeIST` is raw text, `startsAt` is the instant.** The text column
  keeps whatever the model wrote. Ordering uses `startsAt`, filled by
  `parseISTInstant`. Never sort on the text column, and never compare two of
  them as text either: the prompt asks only for a "best effort ISO 8601
  string", so one moment has several legal spellings and `isSameEvent` missed
  duplicates that differed only in spelling. Comparison goes through
  `parseISTClockInstant`, which is `parseISTInstant` minus the bare-date case,
  because a date with no time parses to 05:30 IST and would otherwise equal a
  stated 05:30.
- **Server components fetch directly.** Pages read through Prisma on the server;
  there are no client-side data endpoints. Mutations are form POSTs to
  `api/admin/*`.
- **Admin auth is a shared token** checked per-handler by `requireAdmin`, not by
  middleware. Every new `api/admin/*` route must call it first.

## Commands

```bash
npm run dev              # localhost:3000
npm run ingest           # needs SERPAPI_API_KEY and a running Ollama
npm run prisma:migrate   # after editing schema.prisma (writes to Postgres)
npm run prisma:studio    # browse the database
npx tsc --noEmit         # typecheck
npm test                 # vitest, pure units only
```

## Testing

`npm test` runs vitest against `lib/format.test.ts`, `lib/dedupe.test.ts`,
`lib/confidence.test.ts`, `lib/price.test.ts` and `lib/extraction.test.ts`
(84 cases). All cover pure
functions, so they need no database and no Ollama.
CI runs `npx prisma generate`, `npm run typecheck`, then `npm test` on every
pull request and every push to `main`.

The untested surface is everything that touches I/O: `scripts/ingest.ts`,
the `api/admin/*` handlers, and the server components. `scripts/ingest.ts`
cannot even be imported from a test, because it exits the process at module
load when `SERPAPI_API_KEY` is unset and then runs a full ingest, which is why
the extraction contract lives in `lib/` rather than beside its caller. Extracting a pure
function and testing that, the way `isSameEvent` was pulled into `lib/dedupe.ts`,
is the pattern to follow rather than mocking Prisma.

## Known issues

- Ingestion has no retry or backoff. A transient SerpAPI or Ollama failure drops
  that URL for the run; the next run picks it up again because nothing was
  written.
- `isDuplicate()` loads every candidate for the session into memory on each
  extraction. Correct, and fine at the current row count, but it is a table scan
  per item rather than an indexed lookup.

## A note on this file

This replaced `.github/copilot-instructions.md`, which had drifted from the
code: it still documented `format: "json"` as the extraction approach, told
readers there was no deduplication, and pointed at area-label helpers that had
since moved into `lib/format.ts`. Stale agent instructions are worse than none,
because the next session follows them and undoes the fix. Update this file in
the same commit as any change to the invariants above.
