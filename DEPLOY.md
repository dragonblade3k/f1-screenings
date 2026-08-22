# Deploying to a public URL

The app runs on SQLite locally. Vercel's filesystem is read only and ephemeral,
so the deployed copy needs a hosted Postgres. Neon has a free tier and takes
about two minutes to set up.

## 1. Create a free Postgres

Go to neon.tech, sign in with GitHub, create a project, and copy the connection
string. It looks like:

```
postgresql://user:pass@ep-something.aws.neon.tech/neondb?sslmode=require
```

## 2. Point Prisma at Postgres

In `prisma/schema.prisma`, change the datasource provider:

```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Then regenerate the migration history for Postgres:

```bash
rm -rf prisma/migrations
npx prisma migrate dev --name init
```

## 3. Deploy

```bash
npx vercel login       # opens the browser once
npx vercel link        # accept the defaults
npx vercel env add DATABASE_URL production    # paste the Neon string
npx vercel --prod
```

Vercel prints the live URL when it finishes.

## 4. Move the verified events across

The published events currently live in the local `prisma/dev.db`. To copy them
into the hosted database, point `DATABASE_URL` at Neon locally and re run the
ingest and approval flow, or write a one off script that reads from SQLite and
writes through Prisma to Postgres.

## Note on the admin routes

`/admin/*` is protected only by the `ADMIN_TOKEN` header check in
`lib/admin.ts`. Set a real `ADMIN_TOKEN` in the Vercel environment before
deploying, and never reuse the local development value.
