import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth) return auth;

  const form = await req.formData();
  const id = String(form.get("id") || "");

  const c = await prisma.candidate.findUnique({ where: { id } });
  if (!c) return new Response("Candidate not found", { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.candidate.update({
      where: { id },
      data: { status: "VERIFIED", verifiedAt: new Date() }
    });

    // Create event only if not already created
    const existing = await tx.event.findFirst({ where: { candidateId: id } });
    if (!existing) {
      await tx.event.create({
        data: {
          candidateId: id,
          sport: c.sport,
          area: c.area,
          locality: c.locality,
          venueName: c.venueName || "(unknown venue)",
          address: c.address,
          session: c.session,
          startTimeIST: c.startTimeIST,
          priceINR: c.priceINR,
          bookingUrl: c.bookingUrl,
          contact: c.contact,
          notes: c.notes,
          sourceUrl: c.sourceUrl
        }
      });
    }
  });

  return Response.redirect(new URL("/admin/inbox", req.url));
}
