import { prisma } from "@/lib/prisma";

function areaLabel(a: string) {
  if (a === "MUMBAI") return "Mumbai";
  if (a === "THANE") return "Thane";
  if (a === "NAVI_MUMBAI") return "Navi Mumbai";
  return "Unknown";
}

export default async function HomePage() {
  const events = await prisma.event.findMany({
    orderBy: { startTimeIST: "asc" }
  });

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Verified events (Mumbai Metro)</h2>
      {events.length === 0 ? (
        <p>No verified events yet. Run ingestion and approve in Admin Inbox.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {events.map((e) => (
            <a
              key={e.id}
              href={`/events/${e.id}`}
              style={{
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 10,
                textDecoration: "none",
                color: "inherit"
              }}
            >
              <div style={{ fontWeight: 700 }}>{e.venueName}</div>
              <div style={{ opacity: 0.8 }}>
                {areaLabel(e.area)} • {e.locality || "—"} • {e.session}
              </div>
              <div style={{ opacity: 0.8 }}>{e.startTimeIST || "—"}</div>
              <div style={{ opacity: 0.8 }}>
                Price: ₹{e.priceINR || 0} {e.bookingUrl ? " • Booking link" : ""}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
