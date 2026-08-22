import { prisma } from "@/lib/prisma";
import {
  areaLabel,
  sessionKind,
  sessionLabel,
  formatWhen,
  formatPrice,
  clean
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await prisma.event.findMany({
    orderBy: { startTimeIST: "asc" }
  });

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Mumbai &middot; Thane &middot; Navi Mumbai</div>
        <h1>Every F1 screening in the city, in one place.</h1>
        <p>
          Bars, cafes, and clubs showing the race live. Listings are pulled from across the
          web automatically, then checked by a human before they appear here.
        </p>
      </section>

      <div className="section-label">
        {events.length > 0 ? `${events.length} verified screening${events.length === 1 ? "" : "s"}` : "Verified screenings"}
      </div>

      {events.length === 0 ? (
        <div className="empty">
          <strong>No verified screenings yet</strong>
          Run <code>npm run ingest</code> to pull candidates, then approve them in the{" "}
          <a href="/admin/inbox" className="link-sm" style={{ textDecoration: "underline" }}>admin inbox</a>.
        </div>
      ) : (
        <div className="card-grid">
          {events.map((e) => {
            const kind = sessionKind(e.session);
            const when = formatWhen(e.startTimeIST);
            const price = formatPrice(e.priceINR);
            const locality = clean(e.locality);
            return (
              <a key={e.id} href={`/events/${e.id}`} className={`event-card s-${kind}`}>
                <span className="rail" aria-hidden="true" />
                <div className="badge-row">
                  <span className={`badge ${kind}`}>{sessionLabel(e.session)}</span>
                  {when && (
                    <span className="link-sm">
                      {when.day}{when.time ? ` · ${when.time}` : ""}
                    </span>
                  )}
                </div>
                <div className="top">
                  <div>
                    <h2 className="venue">{e.venueName}</h2>
                    <div className="meta">
                      {areaLabel(e.area)}
                      {locality ? <><span className="dot">·</span>{locality}</> : null}
                    </div>
                  </div>
                  <div className={`price${price.free ? " free" : ""}`}>{price.text}</div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      <footer className="site-footer wrap" style={{ paddingLeft: 0, paddingRight: 0 }}>
        Built by Shantanu Sirjoshi &middot;{" "}
        <a href="https://github.com/dragonblade3k/f1-screenings">source on GitHub</a>
      </footer>
    </>
  );
}
