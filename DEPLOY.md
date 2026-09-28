# Deploying

The app is a Next.js server app on Vercel reading a hosted Postgres. Ingestion
and curation are not deployed and never will be: ingestion needs SerpAPI and a
local Ollama, and curation needs a person. Both run on a laptop against the same
database the deployment reads.

## What runs where

```
laptop                                  Vercel
  npm run ingest      ──┐
  /admin/inbox        ──┤                /            public listing
  /admin/edit/[id]    ──┼──> Postgres <──┤ /events/[id]  single event
  /admin/manual       ──┘    (Supabase)  └ /admin/*      404, see invariant 5
```

`PUBLIC_ONLY=1` is set on Vercel and nowhere else. It makes `requireAdmin` refuse
with 404 and the `/admin` pages call `notFound()`, so the deployed copy cannot
serve the review queue even though the code for it is in the bundle. Without it
the admin pages would be readable by anyone, because they are server components
that query Prisma directly and only the `api/admin` routes ever checked a token.

## The database

Supabase project `f1-screenings` in `ap-south-1`, chosen because every venue is
in the Mumbai Metro region and the laptop running ingestion is there too.

Two connection strings, and which one matters:

- **Pooled**, port `6543`, host `aws-0-ap-south-1.pooler.supabase.com`, with
  `?pgbouncer=true`. This is `DATABASE_URL` for the Vercel runtime. Serverless
  functions open a connection per invocation and Postgres runs out of them
  without a pooler.
- **Direct**, port `5432`, host `db.<ref>.supabase.co`. This is what
  `prisma migrate` needs, because migrations cannot run through a transaction
  pooler. Use it locally and for `DIRECT_URL` if migrations ever move into the
  build.

## First deploy

1. Set on Vercel: `DATABASE_URL` (pooled), `ADMIN_TOKEN` (unused there, but keep
   it set so a misconfiguration cannot leave it empty), and `PUBLIC_ONLY=1`.
2. The build runs `prisma migrate deploy` before `next build`, so the schema is
   applied from `prisma/migrations` by the deploy itself. Nothing is applied by
   hand, which is what keeps the committed history and the live schema honest.
3. Push to `main`. Vercel builds and deploys.

## Loading data

The database starts empty and the public page says so. To fill it, point a local
checkout at the same database and run the real pipeline:

```bash
# .env, local only
DATABASE_URL="postgresql://...:5432/postgres"   # direct, not pooled
SERPAPI_API_KEY="..."
ADMIN_TOKEN="something long"
# PUBLIC_ONLY stays unset locally

ollama serve &
ollama pull llama3
npm run ingest          # writes PENDING candidates
npm run dev             # review at localhost:3000/admin/inbox
```

Approving a candidate writes an `Event`, and the deployed site reads the same
table, so it appears on the public URL immediately. `export const dynamic =
"force-dynamic"` on both public pages means there is no cache to bust.

## A note on migrations

`npx prisma generate` and `npx prisma migrate` need to download Prisma's query
engine from `binaries.prisma.sh`. On a network that blocks it, both fail locally
while CI and the Vercel build, which have open egress, are fine. If you hit that,
the migration SQL in `prisma/migrations` is hand-written and reviewable for
exactly this reason; do not delete it and regenerate.
