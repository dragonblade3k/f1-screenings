# F1 Screenings

Finds Formula 1 screenings across the Mumbai Metro region, extracts the details
from unstructured web pages using a locally run LLM, and puts every result
through human review before it reaches a user.

Next.js 14 (App Router) · TypeScript · Prisma · Ollama (llama3, local) · SerpAPI

---

## The problem

Bars and cafes around Mumbai advertise F1 screenings on aggregator sites,
Instagram, and their own pages. There is no feed, no shared format, and no two
listings that agree on where the venue name goes or how the start time is
written. Scraping rules break on the second site you try.

So extraction is done by a language model, which turns the problem into a more
interesting one: how do you get structured, trustworthy data out of a system
that is free to write anything at all?

---

## How it works

Two stages, deliberately separated.

**Ingestion** — `npm run ingest`

1. SerpAPI runs 20 locality-scoped queries across Mumbai, Thane and Navi Mumbai
2. Each result page is fetched and reduced to text with Cheerio, bounded to 14k
   characters so a local model can hold it
3. llama3 extracts zero or more events per page, with decoding constrained to a
   JSON schema
4. Every extraction is written as a **Candidate** with status `PENDING`.
   Nothing is published

**Curation** — `/admin/inbox`

5. A human reviews each candidate against its source URL and the raw page text
   it came from
6. Approving one creates an **Event**, which is what the public pages read

As of the last ingest run: 70 candidates gathered from 20 distinct sources,
11 verified and published.

---

## Why Candidate and Event are separate tables

The obvious design is one table with an `approved` boolean. This uses two.

A candidate is a *claim a model made about a web page*. An event is a *fact a
person has checked*. They have different lifecycles and different trust levels,
and only one of them should ever reach a user. Splitting them buys three things:

- **The public query cannot leak unverified data.** Reading events is
  `SELECT * FROM Event`. There is no `WHERE approved = true` to forget.
- **Evidence stays with the claim, not the fact.** A candidate carries
  `sourceUrl`, `sourceSnippet`, the full `rawText`, and the exact
  `extractedJson` the model returned. An event carries only the checked fields.
  The audit trail exists without cluttering the read path.
- **Approval is a state transition, not a flag flip.** It creates a row.
  Rejected candidates are kept for inspection rather than deleted, so a bad
  extraction can be traced back to the page that produced it.

---

## The extraction bug, and the actual fix

The first version asked for JSON in the prompt and set Ollama's
`format: "json"`. The shape was described like this:

```
"area":    "MUMBAI|THANE|NAVI_MUMBAI|UNKNOWN",
"session": "FP|QUALI|SPRINT|RACE|UNKNOWN",
"address": "string",
```

The intent was "pick one of these". `format: "json"` guarantees the output
parses. It guarantees nothing whatsoever about the values.

The model read the pipes literally. **73% of extracted rows carried at least one
malformed field:**

| symptom | stored value | cause |
|---|---|---|
| hedged area | `"MUMBAI\|NAVI_MUMBAI"` | pipe read as "and", not "or" |
| whole enum as one value | `"FP\|QUALI\|SPRINT\|RACE\|UNKNOWN"` | same |
| literal placeholder | `"string"` | copied from the sample |
| missing field | `"undefined"` | no constraint to leave it empty |

Four symptoms, one cause: the schema was a suggestion written in prose rather
than a constraint on generation.

Ollama's `format` field accepts a real JSON Schema and constrains decoding to
it. The fix was to stop describing the shape and start enforcing it:

```ts
session: { type: "string", enum: ["FP", "QUALI", "SPRINT", "RACE", "UNKNOWN"] }
```

An illegal value is now not discouraged, it is unreachable. The sampler cannot
emit a token that would violate the schema, so `"FP|QUALI"` is not something
the model is capable of producing any more.

The transferable lesson: if you are validating model output after the fact, the
bug has already happened. Constrain the generation instead.

---

## The read path is still defensive

`lib/format.ts` collapses multi-value strings, ranks sessions by significance,
and filters junk placeholders, even though ingestion can no longer produce any
of them.

That is deliberate. Rows written before the fix are still in the database, and
real systems migrate forward rather than starting clean. Display code that
assumes upstream is perfect breaks the moment it isn't.

`mostSignificant()` also encodes a real judgement rather than just a fallback: a
venue whose listing hedged across `FP|QUALI|SPRINT|RACE` is telling you it shows
the whole weekend, so the headline should be the race, because that is the
session people are actually searching for.

---

## Running it locally

Requires Node 18+ and [Ollama](https://ollama.com) with a model pulled.

```bash
git clone https://github.com/dragonblade3k/f1-screenings.git
cd f1-screenings
npm install

cp .env.example .env      # then fill in the values below
npm run prisma:migrate    # creates the SQLite database
npm run dev               # http://localhost:3000
```

`.env`:

```
DATABASE_URL="file:./dev.db"
SERPAPI_API_KEY="..."      # serpapi.com, free tier is enough
OLLAMA_URL="http://localhost:11434"
LLM_MODEL="llama3"
ADMIN_TOKEN="any-string"   # gates /admin
```

To gather data:

```bash
ollama serve               # in another terminal
npm run ingest             # 20 queries, writes PENDING candidates
```

Then open `/admin/inbox` to review what came back, and `/` to see what has been
published. Deploying to a public URL needs Postgres rather than SQLite —
see [DEPLOY.md](./DEPLOY.md).

---

## Known limitations

- `isDuplicate()` compares each new extraction against only the most recent
  pending candidate instead of all of them, so near-duplicates arriving from
  different sources can both land. The `sourceUrl` early-out catches the common
  case but not this one.
- No automated tests yet. `lib/format.ts` is pure and should be covered first.
- Ingestion is sequential across 20 queries and takes a few minutes.
- Admin auth is a single shared token in an env var. Adequate for a
  one-operator tool, not for anything more.
- SQLite, so the deployed copy needs a hosted Postgres.
