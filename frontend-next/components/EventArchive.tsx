import Link from "next/link";
import CloudinaryImage from "./CloudinaryImage";
import { cloudinaryUrl } from "../lib/cloudinary";
import type { PastEvent } from "../lib/past-events";
export default function EventArchive({ event }: { event: PastEvent }) {
  return <div className="section-wrap archive-detail">
    <Link className="industrial-link" href="/events">All past events</Link>
    <div className="archive-detail__grid">
      <a className="archive-flyer" href={cloudinaryUrl(event.flyer, { width: event.flyer.width })} target="_blank" rel="noopener noreferrer" aria-label={`View full ${event.title} flyer`}>
        <CloudinaryImage asset={event.flyer} alt={`${event.title} original event flyer, ${event.dateLabel}`} maxWidth={1200} sizes="(max-width: 640px) 90vw, 520px" priority />
      </a>
      <div><h1>{event.title}</h1><p className="archive-detail__status">Past event</p>
        <dl><div><dt>DATE</dt><dd><time dateTime={event.date}>{event.dateLabel}</time></dd></div><div><dt>TIME</dt><dd>{event.hours}</dd></div><div><dt>VENUE</dt><dd>{event.venue}</dd></div></dl>
        <h2>Lineup</h2><p>{event.artists}</p><h2>MCs</h2><p>{event.mcs}</p>
        {event.soundSystem && <p className="archive-sound">Sound: {event.soundSystem}</p>}
        <Link className="industrial-button" href="/#stay-connected">Get event updates</Link>
      </div>
    </div>
  </div>;
}
