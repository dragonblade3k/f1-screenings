import { prisma } from "@/lib/prisma";
import AdminHeaderInjector from "@/app/admin/AdminHeaderInjector";
import { areaLabel, sessionKind, sessionLabel, formatWhen, formatPrice, clean } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminInbox() {
  const pending = await prisma.candidate.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" }
  });

  return (
    <>
      <section className="hero" style={{ paddingBottom: 18 }}>
        <div className="eyebrow">Moderation</div>
        <h1 style={{ fontSize: "clamp(24px, 4.5vw, 32px)" }}>Review queue</h1>
        <p>
          Candidates extracted by the ingestion pipeline. Nothing here is public until
          it is approved.
        </p>
      </section>

      <div className="admin-bar">
        <div className="count">
          <b>{pending.length}</b> pending {pending.length === 1 ? "candidate" : "candidates"}
        </div>
        <div className="btn-row">
          <a className="btn ghost" href="/admin/manual">Manual entry</a>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="empty">
          <strong>Queue is clear</strong>
          Run <code>npm run ingest</code> to pull a new batch of candidates.
        </div>
      ) : (
        <div className="card-grid">
          {pending.map((c) => {
            const kind = sessionKind(c.session);
            const when = formatWhen(c.startTimeIST);
            const price = formatPrice(c.priceINR);
            return (
              <div key={c.id} className="cand">
                <div className="badge-row">
                  <span className={`badge ${kind}`}>{sessionLabel(c.session)}</span>
                  <span className="conf">confidence {c.confidence.toFixed(2)}</span>
                </div>

                <div className="top">
                  <div>
                    <h2 className="venue">{c.venueName || "No venue extracted"}</h2>
                    <div className="meta">
                      {areaLabel(c.area)}
                      {clean(c.locality) ? <><span className="dot">·</span>{clean(c.locality)}</> : null}
                      {when ? <><span className="dot">·</span>{when.day}{when.time ? ` ${when.time}` : ""}</> : null}
                    </div>
                  </div>
                  <div className={`price${price.free ? " free" : ""}`}>{price.text}</div>
                </div>

                {c.sourceSnippet ? <div className="snippet">{c.sourceSnippet}</div> : null}

                {c.sourceUrl ? (
                  <div style={{ marginTop: 9 }}>
                    <a className="link-sm" href={c.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {c.sourceTitle || c.sourceUrl} &nearr;
                    </a>
                  </div>
                ) : null}

                <div className="actions">
                  <form action="/api/admin/approve" method="POST">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn primary" type="submit">Approve</button>
                  </form>
                  <a className="btn" href={`/admin/edit/${c.id}`}>Edit and approve</a>
                  <form action="/api/admin/reject" method="POST">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn ghost" type="submit">Reject</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdminSetupNote />
      <AdminHeaderInjector />
    </>
  );
}

function AdminSetupNote() {
  return (
    <div className="empty" style={{ textAlign: "left", marginTop: 22 }}>
      <strong>Local admin setup</strong>
      Approve and reject send an <code>x-admin-token</code> header. Set it once per browser
      session by opening DevTools and running:
      <div className="snippet" style={{ marginTop: 10 }}>
        window.__ADMIN_TOKEN__ = prompt(&quot;Enter ADMIN_TOKEN from .env.local&quot;);
      </div>
    </div>
  );
}
