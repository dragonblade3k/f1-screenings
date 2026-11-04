import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { normalizePriceINR } from "@/lib/price";
import { parseISTInstant } from "@/lib/format";
import { APPROVABLE_STATUSES, approvalRefusal } from "@/lib/review";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  const form = await req.formData();
  const id = String(form.get("id") || "");

  const data = {
    venueName: String(form.get("venueName") || ""),
    area: String(form.get("area") || "UNKNOWN"),
    locality: String(form.get("locality") || ""),
    address: String(form.get("address") || ""),
    session: String(form.get("session") || "UNKNOWN"),
    startTimeIST: String(form.get("startTimeIST") || ""),
    priceINR: normalizePriceINR(form.get("priceINR")),
    bookingUrl: String(form.get("bookingUrl") || ""),
    contact: String(form.get("contact") || ""),
    notes: String(form.get("notes") || "")
  };

  const startsAt = parseISTInstant(data.startTimeIST);

  // Invariant 3: the status change and the Event write are one unit. This route
  // used to do them as three separate calls, so a failure between them left a
  // candidate marked VERIFIED with nothing published, which is the state the
  // invariant exists to make impossible.
  // The status condition sits inside the write for the same reason reject puts
  // it there: a status read beforehand can be stale by the time the write lands.
  // This route matched on the id alone, and of the two approve routes it is the
  // more reachable in a state that should not be approved, because
  // /admin/edit/<id> renders the form for any id whatever status the row is in.
  // See lib/review.ts for which statuses qualify.
  const approved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.candidate.updateMany({
      where: { id, status: { in: [...APPROVABLE_STATUSES] } },
      data: {
        venueName: data.venueName,
        // enums are stored as strings; Prisma will throw if invalid.
        area: data.area as any,
        locality: data.locality,
        address: data.address,
        session: data.session as any,
        startTimeIST: data.startTimeIST,
        startsAt,
        priceINR: data.priceINR,
        bookingUrl: data.bookingUrl,
        contact: data.contact,
        notes: data.notes,
        status: "VERIFIED",
        verifiedAt: new Date()
      }
    });

    // Nothing has been written yet when the condition does not match, so
    // returning here leaves the transaction empty rather than rolling work back.
    if (count === 0) return false;

    // `updateMany` reports how many rows it touched but does not return them,
    // and the Event is written from what was stored rather than from the form,
    // because `sport` and `sourceUrl` belong to the candidate and were never on
    // it. Reading the row back inside the same transaction is what keeps the
    // write and this read consistent.
    const updated = await tx.candidate.findUniqueOrThrow({ where: { id } });

    const fields = {
      sport: updated.sport,
      area: updated.area,
      locality: updated.locality,
      venueName: updated.venueName || "(unknown venue)",
      address: updated.address,
      session: updated.session,
      startTimeIST: updated.startTimeIST,
      startsAt: updated.startsAt,
      priceINR: updated.priceINR,
      bookingUrl: updated.bookingUrl,
      contact: updated.contact,
      notes: updated.notes,
      sourceUrl: updated.sourceUrl
    };

    const existing = await tx.event.findFirst({ where: { candidateId: id } });
    if (existing) {
      await tx.event.update({ where: { id: existing.id }, data: fields });
    } else {
      await tx.event.create({ data: { candidateId: id, ...fields } });
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

  return Response.redirect(new URL("/", req.url));
}
