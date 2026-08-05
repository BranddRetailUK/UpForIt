import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CloudinaryImage from "../../../components/CloudinaryImage";
import TicketSelector from "../../../components/TicketSelector";
import { getCurrentUser } from "../../../lib/auth";
import { CLOUDINARY_ASSETS } from "../../../lib/cloudinary";
import { getPool } from "../../../lib/db";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string; title: string; description: string; venue_name: string; starts_at: Date; ends_at: Date; timezone: string;
};
type TierRow = { id: string; name: string; price_minor: number; max_per_order: number; is_active: boolean };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug !== "summer-roundup-2026") return { title: "Event" };
  return { title: "The Summer Roundup tickets", description: "Buy tickets for The Summer Roundup on 26 September 2026." };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const eventResult = await getPool().query<EventRow>(
    `SELECT id, title, description, venue_name, starts_at, ends_at, timezone
       FROM events WHERE slug = $1 AND status = 'published'`,
    [slug]
  );
  const event = eventResult.rows[0];
  if (!event) notFound();
  const [tierResult, user] = await Promise.all([
    getPool().query<TierRow>(
      "SELECT id, name, price_minor, max_per_order, is_active FROM ticket_types WHERE event_id = $1 ORDER BY sort_order, price_minor",
      [event.id]
    ),
    getCurrentUser()
  ]);
  const eventDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: event.timezone }).format(new Date(event.starts_at));
  const eventTime = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(new Date(event.starts_at));
  const endTime = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(new Date(event.ends_at));

  return (
    <div className="inner-page section-wrap">
      <article className="event-card event-card--tickets">
        <p className="event-card__eyebrow">UPFORIT presents</p>
        <h1 className="event-card__title">
          <CloudinaryImage asset={CLOUDINARY_ASSETS.summerRoundup} alt={event.title} className="event-card__wordmark" sizes="(max-width: 720px) 86vw, 760px" maxWidth={1476} priority />
        </h1>
        <p className="event-description">{event.description}</p>
        <div className="event-facts">
          <div className="event-fact event-fact--yellow"><div><span className="event-fact__label">Date</span><span>{eventDate}</span></div></div>
          <div className="event-fact event-fact--pink"><div><span className="event-fact__label">Time</span><span>{eventTime}–{endTime}</span></div></div>
          <div className="event-fact event-fact--blue"><div><span className="event-fact__label">Venue</span><span>{event.venue_name}</span></div></div>
        </div>
        <TicketSelector
          signedIn={Boolean(user)}
          tiers={tierResult.rows.map((tier) => ({
            id: tier.id, name: tier.name, priceMinor: tier.price_minor,
            maxPerOrder: tier.max_per_order, active: tier.is_active
          }))}
        />
      </article>
    </div>
  );
}
