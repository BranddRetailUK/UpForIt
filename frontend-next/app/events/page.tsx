import { PAST_EVENTS } from "../../lib/past-events";
import type { Metadata } from "next";
import Link from "next/link";
import PastEventCard from "../../components/PastEventCard";
export const metadata: Metadata = { title: "Events", description: "Stay connected with UPFORIT and explore our past events.", alternates: { canonical: "/events" } };
export default function EventsPage() {
 return <div className="section-wrap bass-events"><header><h1>SEE YOU ON<br />THE <em>DANCEFLOOR.</em></h1><p>Stay in the loop for future event announcements.</p><Link className="industrial-button" href="/#stay-connected">Get event updates </Link></header><section aria-labelledby="past-events"><div className="bass-section-heading"><h2 id="past-events">THE <em>ARCHIVE.</em></h2></div><div className="past-event-list">{PAST_EVENTS.map(event => <PastEventCard key={event.slug} event={event} />)}</div></section></div>;
}
