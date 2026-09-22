import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

// Reject moves a PENDING candidate to REJECTED and keeps the row, so a bad
// extraction can still be traced back to the page and model output that
// produced it. Ingestion's duplicate check compares against candidates of
// every status, which is what stops a rejected venue reappearing in the queue
// on the next run.
//
// Only PENDING candidates can be rejected. A VERIFIED candidate already has a
// public Event, and flipping its status here would leave that Event live while
// the candidate claimed otherwise. The status condition sits inside the update
// itself rather than in a read beforehand, so an approve landing between the
// two cannot be overwritten.
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  const form = await req.formData();
  const id = String(form.get("id") || "");

  const { count } = await prisma.candidate.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED" }
  });

  if (count === 0) {
    const c = await prisma.candidate.findUnique({ where: { id }, select: { status: true } });
    if (!c) return new Response("Candidate not found", { status: 404 });
    return new Response(`Candidate is ${c.status}, only PENDING candidates can be rejected`, {
      status: 409
    });
  }

  return Response.redirect(new URL("/admin/inbox", req.url));
}
