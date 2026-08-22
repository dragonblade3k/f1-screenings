import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

function asInt(v: string, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

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
    priceINR: asInt(String(form.get("priceINR") || "0")),
    bookingUrl: String(form.get("bookingUrl") || ""),
    contact: String(form.get("contact") || ""),
    notes: String(form.get("notes") || "")
  };

  const updated = await prisma.candidate.update({
    where: { id },
    data: {
      venueName: data.venueName,
      // enums are stored as strings; Prisma will throw if invalid.
      area: data.area as any,
      locality: data.locality,
      address: data.address,
      session: data.session as any,
      startTimeIST: data.startTimeIST,
      priceINR: data.priceINR,
      bookingUrl: data.bookingUrl,
      contact: data.contact,
      notes: data.notes,
      status: "VERIFIED",
      verifiedAt: new Date()
    }
  });

  // Upsert Event
  const existing = await prisma.event.findFirst({ where: { candidateId: id } });
  if (existing) {
    await prisma.event.update({
      where: { id: existing.id },
      data: {
        sport: updated.sport,
        area: updated.area,
        locality: updated.locality,
        venueName: updated.venueName || "(unknown venue)",
        address: updated.address,
        session: updated.session,
        startTimeIST: updated.startTimeIST,
        priceINR: updated.priceINR,
        bookingUrl: updated.bookingUrl,
        contact: updated.contact,
        notes: updated.notes,
        sourceUrl: updated.sourceUrl
      }
    });
  } else {
    await prisma.event.create({
      data: {
        candidateId: id,
        sport: updated.sport,
        area: updated.area,
        locality: updated.locality,
        venueName: updated.venueName || "(unknown venue)",
        address: updated.address,
        session: updated.session,
        startTimeIST: updated.startTimeIST,
        priceINR: updated.priceINR,
        bookingUrl: updated.bookingUrl,
        contact: updated.contact,
        notes: updated.notes,
        sourceUrl: updated.sourceUrl
      }
    });
  }

  return Response.redirect(new URL("/", req.url));
}
