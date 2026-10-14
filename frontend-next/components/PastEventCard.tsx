import Link from "next/link";
import CloudinaryImage from "./CloudinaryImage";
import type { PastEvent } from "../lib/past-events";
export default function PastEventCard({ event }: { event: PastEvent }) {
  return (
    <Link className="past-event" href={`/events/${event.slug}`}>
      <CloudinaryImage asset={event.flyer} alt={`${event.title} original flyer`} maxWidth={320} sizes="100px" />
      <div><h3>{event.title}</h3><p>{event.venue}</p><time className="past-event__date" dateTime={event.date}>{event.dateLabel}</time></div>
      <span className="past-event__link">Look back</span>
    </Link>
  );
}
