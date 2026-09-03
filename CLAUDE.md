# Working in this repo

Context for Claude Code sessions. See [README.md](./README.md) for what the
project is and why it is built this way.

## Invariants — do not regress these

1. **Extraction decoding is schema-constrained.** `scripts/ingest.ts` passes
   `EVENT_SCHEMA` (a real JSON Schema, with `enum` arrays) as Ollama's `format`.
   Do **not** change this back to `format: "json"` and describe the shape in the
   prompt. That was the original implementation and it produced malformed values
   in 73% of rows: `"MUMBAI|NAVI_MUMBAI"`, the literal string `"string"`,
   `"undefined"`. `format: "json"` guarantees the output parses, not that the
   values are legal. If a field needs a fixed set of values, put an `enum` in
   `EVENT_SCHEMA`.

2. **Nothing reaches the public pages without human approval.** Ingestion writes
   `Candidate` rows only. `Event` rows are created solely by the approve
   handlers. Public pages read `Event` and must never query `Candidate`.

3. **Approval is atomic.** `api/admin/approve` and `update-and-approve` wrap the
   status update and the `Event` insert in `prisma.$transaction`. Keep it.

4. **Display formatting lives in `lib/format.ts`.** Pages must not re-implement
   area or session labels locally. The helpers there are intentionally defensive
   about malformed values because pre-fix rows are still in the database.

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
    manual-create/route.ts       create an Event directly
    _token.ts                    token constant
lib/
  format.ts                      display helpers, defensive (see invariant 4)
  admin.ts                       requireAdmin(req)
  prisma.ts                      client singleton
scripts/
  ingest.ts                      SerpAPI -> fetch -> Cheerio -> Ollama -> Candidate
prisma/
  schema.prisma                  Candidate and Event
```

## Conventions

- **Status and enum fields are plain strings**, not TypeScript enums. SQLite has
  no native enum and the values cross a model boundary. Legal values are
  documented as comments in `schema.prisma` and enforced in `EVENT_SCHEMA`.
- **Env-first config.** No hardcoded service URLs beyond defaults in
  `ingest.ts`. See `.env.example`.
- **Server components fetch directly.** Pages read through Prisma on the server;
  there are no client-side data endpoints. Mutations are form POSTs to
  `api/admin/*`.
- **Admin auth is a shared token** checked per-handler by `requireAdmin`, not by
  middleware. Every new `api/admin/*` route must call it first.

## Commands

```bash
npm run dev              # localhost:3000
npm run ingest           # needs SERPAPI_API_KEY and a running Ollama
npm run prisma:migrate   # after editing schema.prisma
npm run prisma:studio    # browse the database
npx tsc --noEmit         # typecheck
```

## Known issues

- `isDuplicate()` in `ingest.ts` compares each extraction against only the most
  recent pending candidate rather than all of them, so near-duplicates from
  different sources can both land. The `sourceUrl` early-out covers the common
  case.
- No test suite yet. `lib/format.ts` is pure and is the right place to start.

## A note on this file

This replaced `.github/copilot-instructions.md`, which had drifted from the
code: it still documented `format: "json"` as the extraction approach, told
readers there was no deduplication, and pointed at area-label helpers that had
since moved into `lib/format.ts`. Stale agent instructions are worse than none,
because the next session follows them and undoes the fix. Update this file in
the same commit as any change to the invariants above.
