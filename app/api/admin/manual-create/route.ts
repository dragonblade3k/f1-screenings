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
  const venueName = String(form.get("venueName") || "(unknown venue)");

  await prisma.event.create({
    data: {
      venueName,
      area: String(form.get("area") || "UNKNOWN") as any,
      locality: String(form.get("locality") || ""),
      address: String(form.get("address") || ""),
      session: String(form.get("session") || "UNKNOWN") as any,
      startTimeIST: String(form.get("startTimeIST") || ""),
      priceINR: asInt(String(form.get("priceINR") || "0")),
      bookingUrl: String(form.get("bookingUrl") || ""),
      contact: String(form.get("contact") || ""),
      notes: String(form.get("notes") || ""),
      sourceUrl: String(form.get("sourceUrl") || "")
    }
  });

  return Response.redirect(new URL("/", req.url));
}
