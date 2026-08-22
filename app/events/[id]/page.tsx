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

export default async function EventDetail({ params }: { params: { id: string } }) {
  const e = await prisma.event.findUnique({ where: { id: params.id } });

  if (!e) {
    return (
      <>
        <a href="/" className="back">&larr; All screenings</a>
        <div className="empty"><strong>Screening not found</strong>It may have been removed.</div>
      </>
    );
  }

  const kind = sessionKind(e.session);
  const when = formatWhen(e.startTimeIST);
  const price = formatPrice(e.priceINR);
  const locality = clean(e.locality);
  const address = clean(e.address);
  const notes = clean(e.notes);
  const contact = clean(e.contact);
  const mapsQ = encodeURIComponent(`${e.venueName} ${address} ${areaLabel(e.area)}`);

  return (
    <div className="detail">
      <a href="/" className="back">&larr; All screenings</a>

      <div className="badge-row">
        <span className={`badge ${kind}`}>{sessionLabel(e.session)}</span>
        <span className="link-sm">{areaLabel(e.area)}{locality ? ` · ${locality}` : ""}</span>
      </div>

      <h1>{e.venueName}</h1>

      <dl className="facts">
        <div className="fact">
          <dt>When</dt>
          <dd>{when ? `${when.day}${when.time ? ` · ${when.time}` : ""}` : "To be confirmed"}</dd>
        </div>
        <div className="fact">
          <dt>Entry</dt>
          <dd>{price.text}</dd>
        </div>
        <div className="fact">
          <dt>Area</dt>
          <dd>{areaLabel(e.area)}</dd>
        </div>
        {contact ? (
          <div className="fact">
            <dt>Contact</dt>
            <dd>{contact}</dd>
          </div>
        ) : null}
      </dl>

      {address ? (
        <p style={{ color: "var(--ink-dim)", marginTop: 0 }}>{address}</p>
      ) : null}

      {notes ? (
        <p style={{ color: "var(--ink-dim)" }}>{notes}</p>
      ) : null}

      <div className="btn-row">
        {e.bookingUrl ? (
          <a className="btn primary" href={e.bookingUrl} target="_blank" rel="noopener noreferrer">
            Book a table
          </a>
        ) : null}
        <a
          className="btn"
          href={`https://www.google.com/maps/search/?api=1&query=${mapsQ}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Maps
        </a>
        {e.sourceUrl ? (
          <a className="btn ghost" href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
            Original listing
          </a>
        ) : null}
      </div>

      <footer className="site-footer">
        Listing verified by a human before publishing.{" "}
        <a href="https://github.com/dragonblade3k/f1-screenings">How this works</a>
      </footer>
    </div>
  );
}
