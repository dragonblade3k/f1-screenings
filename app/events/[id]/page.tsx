import { prisma } from "@/lib/prisma";

function areaLabel(a: string) {
  if (a === "MUMBAI") return "Mumbai";
  if (a === "THANE") return "Thane";
  if (a === "NAVI_MUMBAI") return "Navi Mumbai";
  return "Unknown";
}

export default async function EventDetail({ params }: { params: { id: string } }) {
  const e = await prisma.event.findUnique({ where: { id: params.id } });
  if (!e) return <div>Not found.</div>;

  const mapsQ = encodeURIComponent(`${e.venueName} ${e.address} ${areaLabel(e.area)}`);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0 }}>{e.venueName}</h2>
      <div>
        <b>Area:</b> {areaLabel(e.area)} {e.locality ? `• ${e.locality}` : ""}
      </div>
      <div>
        <b>Session:</b> {e.session}
      </div>
      <div>
        <b>Start (IST):</b> {e.startTimeIST || "—"}
      </div>
      <div>
        <b>Address:</b> {e.address || "—"}
      </div>
      <div>
        <b>Price:</b> ₹{e.priceINR || 0}
      </div>
      {e.bookingUrl ? (
        <div>
          <b>Booking:</b> <a href={e.bookingUrl}>{e.bookingUrl}</a>
        </div>
      ) : null}
      {e.sourceUrl ? (
        <div>
          <b>Source:</b> <a href={e.sourceUrl}>{e.sourceUrl}</a>
        </div>
      ) : null}
      <div>
        <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQ}`}>Open in Google Maps</a>
      </div>
      {e.notes ? <div><b>Notes:</b> {e.notes}</div> : null}
    </div>
  );
}
