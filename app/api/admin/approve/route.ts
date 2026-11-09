import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { APPROVABLE_STATUSES, approvalRefusal } from "@/lib/review";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  const form = await req.formData();
  const id = String(form.get("id") || "");

  const c = await prisma.candidate.findUnique({ where: { id } });
  if (!c) return new Response("Candidate not found", { status: 404 });

  // The status condition sits inside the write rather than in the read above,
  // for the reason the reject route gives: a status read beforehand can be stale
  // by the time the write lands. See lib/review.ts for which statuses qualify
  // and why this route had no condition at all.
  const approved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.candidate.updateMany({
      where: { id, status: { in: [...APPROVABLE_STATUSES] } },
      data: { status: "VERIFIED", verifiedAt: new Date() }
    });

    // Nothing has been written yet when the condition does not match, so
    // returning here leaves the transaction empty rather than rolling work back.
    if (count === 0) return false;

    // Create event only if not already created
    const existing = await tx.event.findFirst({ where: { candidateId: id } });
    if (!existing) {
      await tx.event.create({
        data: {
          candidateId: id,
          sport: c.sport,
          area: c.area,
          locality: c.locality,
          // Written as stored, empty included. `Event.venueName` is required but
          // not non-empty, and both public pages already have a sentence for a
          // row that names no venue. Substituting one here produced a different
          // sentence that `venueName()` then read as a real name.
          venueName: c.venueName,
          address: c.address,
          session: c.session,
          startTimeIST: c.startTimeIST,
          startsAt: c.startsAt,
          priceINR: c.priceINR,
          bookingUrl: c.bookingUrl,
          contact: c.contact,
          notes: c.notes,
          sourceUrl: c.sourceUrl
        }
      });
    }

    return true;
  });

  if (!approved) {
    const current = await prisma.candidate.findUnique({
      where: { id },
      select: { status: true }
    });
    if (!current) return new Response("Candidate not found", { status: 404 });
    return new Response(approvalRefusal(current.status), { status: 409 });
  }

  return Response.redirect(new URL("/admin/inbox", req.url));
}
