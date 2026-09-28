// Which surfaces this process serves.
//
// Ingestion needs SerpAPI and a local Ollama, and curation is one person
// reviewing model output against its source, so neither belongs on a public
// host. The deployed copy is the read-only product: the public listing and the
// event pages. Everything under /admin and /api/admin is absent from it.
//
// This matters beyond tidiness. The admin pages are server components that
// query Prisma and render candidate rows directly, and only the api/admin
// routes ever checked a token, so a public deployment without this gate would
// let anyone who visited /admin/inbox read the entire unreviewed queue,
// including the full rawText of every scraped page.
export function isPublicOnly(): boolean {
  return process.env.PUBLIC_ONLY === "1";
}
