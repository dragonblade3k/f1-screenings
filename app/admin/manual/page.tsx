import AdminHeaderInjector from "@/app/admin/AdminHeaderInjector";
export default function ManualEntry() {
  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Manual entry (creates VERIFIED event)</h2>

      <form action="/api/admin/manual-create" method="POST" style={{ display: "grid", gap: 10 }}>
        <label>
          Venue name
          <input name="venueName" placeholder="e.g., The Bar Stock Exchange" style={{ width: "100%" }} />
        </label>

        <label>
          Area (MUMBAI / THANE / NAVI_MUMBAI)
          <input name="area" placeholder="THANE" style={{ width: "100%" }} />
        </label>

        <label>
          Locality
          <input name="locality" placeholder="Thane West" style={{ width: "100%" }} />
        </label>

        <label>
          Address
          <input name="address" placeholder="Full address" style={{ width: "100%" }} />
        </label>

        <label>
          Session (QUALI / RACE / SPRINT / FP)
          <input name="session" placeholder="RACE" style={{ width: "100%" }} />
        </label>

        <label>
          Start time IST
          <input name="startTimeIST" placeholder="2026-03-08T22:30:00+05:30" style={{ width: "100%" }} />
        </label>

        <label>
          Price INR
          <input name="priceINR" defaultValue="0" style={{ width: "100%" }} />
        </label>

        <label>
          Booking URL
          <input name="bookingUrl" defaultValue="" style={{ width: "100%" }} />
        </label>

        <label>
          Contact
          <input name="contact" defaultValue="" style={{ width: "100%" }} />
        </label>

        <label>
          Notes
          <input name="notes" defaultValue="" style={{ width: "100%" }} />
        </label>

        <label>
          Source URL
          <input name="sourceUrl" defaultValue="" style={{ width: "100%" }} />
        </label>

        <button>Create VERIFIED event</button>
      </form>

      <p style={{ marginTop: 12, opacity: 0.8 }}>
        Requires admin token header. Use the console snippet on the Inbox page once.
      </p>

      <AdminHeaderInjector />
    </div>
  );
}
