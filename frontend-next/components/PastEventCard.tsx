import Link from "next/link";
import CloudinaryImage from "./CloudinaryImage";
import type { PastEvent } from "../lib/past-events";
export default function PastEventCard({ event }: { event: PastEvent }) {
  return (
    <Link className="past-event" href={`/events/${event.slug}`}>
      <CloudinaryImage asset={event.flyer} alt={`${event.title} original flyer`} maxWidth={320} sizes="100px" />
      <div><time className="past-event__date" dateTime={event.date}>{event.dateLabel}</time><h3>{event.title}</h3><p>{event.venue}</p></div>
      <span className="past-event__link">Look back</span>
    </Link>
  );
}
