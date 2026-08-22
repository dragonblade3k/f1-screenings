import { prisma } from "@/lib/prisma";
import AdminHeaderInjector from "@/app/admin/AdminHeaderInjector";

function areaLabel(a: string) {
  if (a === "MUMBAI") return "Mumbai";
  if (a === "THANE") return "Thane";
  if (a === "NAVI_MUMBAI") return "Navi Mumbai";
  return "Unknown";
}

export default async function AdminInbox() {
  const pending = await prisma.candidate.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Admin Inbox (PENDING)</h2>

      <p style={{ opacity: 0.8 }}>
        Tip: set your token in <code>.env.local</code> and add it in the Admin UI prompt when approving/rejecting.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <a href="/admin/manual">Manual entry</a>
        <a href="/admin/all">All candidates</a>
      </div>

      {pending.length === 0 ? (
        <p>No pending candidates. Run <code>npm run ingest</code>.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {pending.map((c) => (
            <div key={c.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{c.venueName || "(no venue extracted)"}</div>
                  <div style={{ opacity: 0.8 }}>
                    {areaLabel(c.area)} • {c.locality || "—"} • {c.session} • {c.startTimeIST || "—"}
                  </div>
                  <div style={{ opacity: 0.8 }}>₹{c.priceINR || 0} {c.bookingUrl ? "• has booking link" : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ opacity: 0.8 }}>conf: {c.confidence.toFixed(2)}</div>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>{new Date(c.createdAt).toLocaleString()}</div>
                </div>
              </div>

              {c.sourceUrl ? (
                <div style={{ marginTop: 8 }}>
                  <b>Source:</b> <a href={c.sourceUrl}>{c.sourceUrl}</a>
                  {c.sourceSnippet ? <div style={{ opacity: 0.8, marginTop: 4 }}>{c.sourceSnippet}</div> : null}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <form action={`/api/admin/approve`} method="POST">
                  <input type="hidden" name="id" value={c.id} />
                  <button>Approve</button>
                </form>

                <form action={`/api/admin/reject`} method="POST">
                  <input type="hidden" name="id" value={c.id} />
                  <button>Reject</button>
                </form>

                <a href={`/admin/edit/${c.id}`}>Edit & Approve</a>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                Note: approve/reject require header <code>x-admin-token</code> via prompt on submit (see below).
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminTokenHelper />
      <AdminHeaderInjector />
    </div>
  );
}

function AdminTokenHelper() {
  return (
    <div style={{ marginTop: 18, padding: 12, border: "1px dashed #ddd", borderRadius: 10 }}>
      <div style={{ fontWeight: 700 }}>One-time setup for local admin actions</div>
      <ol style={{ margin: "8px 0 0 18px" }}>
        <li>Open DevTools Console in your browser.</li>
        <li>Paste this snippet once (it will inject your token into requests):</li>
      </ol>
      <pre style={{ background: "#fafafa", padding: 12, borderRadius: 10, overflowX: "auto" }}>{`// Paste in browser console ONCE (local POC)
window.__ADMIN_TOKEN__ = prompt("Enter ADMIN_TOKEN from .env.local");`}</pre>
      <p style={{ margin: "8px 0 0 0", opacity: 0.85 }}>
        Then the approve/reject/edit pages will attach <code>x-admin-token</code> automatically.
      </p>
    </div>
  );
}

