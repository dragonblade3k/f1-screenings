# AI Agent Instructions for F1 Screenings Codebase

## Project Overview

**F1 Screenings** is a web application that discovers, curates, and displays Formula 1 screening events in the Mumbai Metro region (Mumbai, Thane, Navi Mumbai). The system automates event discovery via web search + LLM extraction, allows manual entry, and provides an admin interface for verification before publishing to users.

**Tech Stack**: Next.js 14 (App Router, Server Components), TypeScript, Prisma ORM with SQLite, local Ollama LLM for event extraction, SerpAPI for web search.

---

## Architecture & Data Flow

### Two-Stage Event Pipeline
1. **Ingestion** (`npm run ingest`): Runs `scripts/ingest.ts`
   - Uses SerpAPI to search for F1 screenings across Mumbai Metro localities
   - Fetches webpage HTML, extracts text via Cheerio
   - Sends text to local Ollama LLM with structured JSON extraction prompt
   - Stores raw extractions as **Candidates** with status `PENDING`

2. **Admin Curation** (`/admin/inbox`):
   - Humans review pending Candidates (sorted by recency)
   - Approve → creates Event record, updates Candidate status to `VERIFIED`
   - Reject → marks Candidate status as `REJECTED`
   - Edit & Approve → `/admin/edit/[id]` allows manual correction before promoting

### Data Model (Prisma/schema.prisma)
- **Candidate**: Raw extraction with `status` (PENDING|VERIFIED|REJECTED), `confidence` score, LLM-extracted fields
- **Event**: Curated, published events (1:1 relation to approved Candidate via `candidateId`)
- Key enums: `area` (MUMBAI|THANE|NAVI_MUMBAI|UNKNOWN), `session` (FP|QUALI|SPRINT|RACE|UNKNOWN)

---

## Key Workflows

### Running Ingestion
```bash
npm run ingest
```
- Requires `.env` with `SERPAPI_API_KEY`, `OLLAMA_URL` (default: http://localhost:11434), `LLM_MODEL` (default: llama3)
- Searches 44 hardcoded queries across locality combinations
- Writes Candidates to DB; stdout logs extraction JSON per search result
- No deduplication—same event may appear multiple times; admin inbox deduplicates via review

### Admin Token Authentication
- All `/api/admin/*` routes require `x-admin-token` header matching `ADMIN_TOKEN` env var
- Unauthenticated requests return 401; no route-level middleware (checked in each handler)
- **Local Dev**: Set token in `.env.local`, inject via browser console: `window.__ADMIN_TOKEN__ = "..."`, then approved/reject forms attach it
- See [AdminHeaderInjector.tsx](app/admin/AdminHeaderInjector.tsx) for client-side token injection

### Database Migrations
```bash
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Interactive migration (creates numbered migration files)
npm run prisma:studio    # Web UI to browse/edit DB
```

---

## Common Patterns & Conventions

### Environment Variables
- `ADMIN_TOKEN`: Admin route authentication (no default, must set for prod)
- `OLLAMA_URL`: Local LLM endpoint (default: http://localhost:11434)
- `LLM_MODEL`: Model name to pass to Ollama (default: llama3)
- `SERPAPI_API_KEY`: Web search API key (no default, required for ingest)
- `DATABASE_URL`: SQLite path (no default, inferred from `.env` if unset)

### LLM Extraction
- Extraction logic in `scripts/ingest.ts` (lines ~100–130): generates structured prompt, calls Ollama `/api/generate` endpoint with `format: "json"`
- Expected output: `{"events": [{...event...}]}` or `{"events": []}`
- Confidence score (0.0–1.0) embedded in extraction; reflects LLM confidence in event relevance
- No retry logic for failed extractions; logged to stdout

### Area/Locality Labeling
- Helper function in [app/page.tsx](app/page.tsx#L4) and [app/admin/inbox/page.tsx](app/admin/inbox/page.tsx#L4): maps `area` enum to display labels
- Add new localities by: (1) updating Prisma schema enum comment, (2) adding query in `QUERIES[]` in ingest script, (3) extending area label function

### Server-Side Rendering
- All pages fetch data server-side (no client-side hydration data calls)
- `app/page.tsx`: fetches Events, groups by area for public view
- `app/admin/*`: fetch Candidates for review; forms POST to API routes
- No API data client endpoints; all state mutations via form submissions

### Admin Edit Workflow
- Route: `/admin/edit/[id]` → [app/admin/edit/[id]/page.tsx](app/admin/edit/[id]/page.tsx)
- Allows inline field correction before approval
- POST to `/api/admin/update-and-approve` with updated fields

---

## File Organization

```
app/
  page.tsx                      # Public: lists verified Events
  layout.tsx                    # Root layout with nav header
  api/admin/
    approve/route.ts            # POST: Candidate → VERIFIED, create Event
    manual-create/route.ts      # POST: Create Event directly (bypass Candidate)
    update-and-approve/route.ts # POST: Edit Candidate fields + approve
  admin/
    inbox/page.tsx              # Review pending Candidates
    edit/[id]/page.tsx          # Inline edit before approval
    AdminHeaderInjector.tsx      # Client-side token injection for forms
lib/
  admin.ts                      # requireAdmin(req): auth middleware
  prisma.ts                     # Prisma client export
scripts/
  ingest.ts                     # Main ingestion pipeline
prisma/
  schema.prisma                 # Data model
```

---

## Development Tips

### Debugging Ingestion
- Check stdout during `npm run ingest` for extraction JSON per URL
- Verify `.env` has valid `SERPAPI_API_KEY` and local Ollama running
- Query locality in `QUERIES` if new area added
- Confidence <0.5 often indicates false positives; can be filtered in UI later

### Testing Admin Routes
- Manually set `x-admin-token` header in browser DevTools Network tab, or
- Use curl: `curl -X POST http://localhost:3000/api/admin/approve -H "x-admin-token: test-token" -d "id=..."`

### Database Inspection
- Run `npm run prisma:studio` to open Prisma web UI; explore Candidates/Events
- Check `createdAt`, `verifiedAt`, `sourceUrl` for audit trail

---

## Patterns to Preserve

1. **Env-first config**: All external service URLs/keys from `.env`; no hardcoded URLs except defaults
2. **Transactional approval**: Use `prisma.$transaction` when creating Event from Candidate to ensure atomicity
3. **Status enums as strings**: Not TypeScript enums; easier for LLM extraction and DB filtering
4. **Confidence scores**: Always extracted; allows future ranking/filtering of low-confidence extractions
5. **No deduplication during ingest**: Rely on admin review; simpler logic, human judgment catches duplicates

---

## Next Steps for Contributors

- **Expanding search**: Add more queries to `QUERIES[]` in `scripts/ingest.ts`, or parameterize area/sport filters
- **Filtering low-confidence**: Add confidence threshold in inbox or public view
- **Manual import**: Extend `/api/admin/manual-create` to accept CSV upload
- **Multi-sport support**: Schema already has `sport` field; add sport selector to ingestion and UI
