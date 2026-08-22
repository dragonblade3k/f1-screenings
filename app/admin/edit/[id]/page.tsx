import { prisma } from "@/lib/prisma";
import AdminHeaderInjector from "@/app/admin/AdminHeaderInjector";

export default async function EditCandidate({ params }: { params: { id: string } }) {
  const c = await prisma.candidate.findUnique({ where: { id: params.id } });
  if (!c) return <div>Not found.</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Edit & Approve</h2>

      <form action="/api/admin/update-and-approve" method="POST" style={{ display: "grid", gap: 10 }}>
        <input type="hidden" name="id" value={c.id} />

        <label>
          Venue name
          <input name="venueName" defaultValue={c.venueName} style={{ width: "100%" }} />
        </label>

        <label>
          Area (MUMBAI / THANE / NAVI_MUMBAI)
          <input name="area" defaultValue={c.area} style={{ width: "100%" }} />
        </label>

        <label>
          Locality
          <input name="locality" defaultValue={c.locality} style={{ width: "100%" }} />
        </label>

        <label>
          Address
          <input name="address" defaultValue={c.address} style={{ width: "100%" }} />
        </label>

        <label>
          Session (QUALI / RACE / SPRINT / FP)
          <input name="session" defaultValue={c.session} style={{ width: "100%" }} />
        </label>

        <label>
          Start time IST (ISO string preferred)
          <input name="startTimeIST" defaultValue={c.startTimeIST} style={{ width: "100%" }} />
        </label>

        <label>
          Price INR
          <input name="priceINR" defaultValue={String(c.priceINR)} style={{ width: "100%" }} />
        </label>

        <label>
          Booking URL
          <input name="bookingUrl" defaultValue={c.bookingUrl} style={{ width: "100%" }} />
        </label>

        <label>
          Contact
          <input name="contact" defaultValue={c.contact} style={{ width: "100%" }} />
        </label>

        <label>
          Notes
          <input name="notes" defaultValue={c.notes} style={{ width: "100%" }} />
        </label>

        <button>Save + Approve</button>
      </form>
    
    <AdminHeaderInjector />

    </div>
  );
}
