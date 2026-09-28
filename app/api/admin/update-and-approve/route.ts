import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { normalizePriceINR } from "@/lib/price";
import { parseISTInstant } from "@/lib/format";

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
  await prisma.$transaction(async (tx) => {
    const updated = await tx.candidate.update({
      where: { id },
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
  });

  return Response.redirect(new URL("/", req.url));
}
