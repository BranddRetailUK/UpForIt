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
type TierRow = {
  id: string;
  name: string;
  price_minor: number;
  max_per_order: number;
  capacity: number | null;
  sort_order: number;
  is_active: boolean;
  paid_quantity: string;
  reserved_quantity: string;
};

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
      `SELECT tt.id, tt.name, tt.price_minor, tt.max_per_order, tt.capacity, tt.sort_order, tt.is_active,
              COALESCE(sum(i.quantity) FILTER (WHERE o.status = 'paid'), 0)::text AS paid_quantity,
              COALESCE(sum(i.quantity) FILTER (
                WHERE o.status = 'pending' AND o.reserved_until > now()
              ), 0)::text AS reserved_quantity
         FROM ticket_types tt
         LEFT JOIN ticket_order_items i ON i.ticket_type_id = tt.id
         LEFT JOIN ticket_orders o ON o.id = i.order_id
        WHERE tt.event_id = $1
        GROUP BY tt.id
        ORDER BY tt.sort_order, tt.price_minor`,
      [event.id]
    ),
    getCurrentUser()
  ]);
  const eventDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: event.timezone }).format(new Date(event.starts_at));
  const eventTime = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(new Date(event.starts_at));
  const endTime = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: event.timezone }).format(new Date(event.ends_at));
  const activeSortOrder = tierResult.rows.find((tier) => tier.is_active)?.sort_order;

  return (
    <div className="inner-page section-wrap event-detail-page">
      <article className="event-card event-card--tickets">
        <p className="event-card__eyebrow">UPFORIT presents</p>
        <h1 className="event-card__title">
          <CloudinaryImage asset={CLOUDINARY_ASSETS.summerRoundup} alt={event.title} className="event-card__wordmark" sizes="(max-width: 720px) 86vw, 760px" maxWidth={1476} priority />
        </h1>
        <p className="event-description">{event.description}</p>
        <dl className="event-summary-banner" aria-label="Event details">
          <div className="event-summary-banner__item event-summary-banner__item--date">
            <dt>Date</dt>
            <dd><time dateTime={new Date(event.starts_at).toISOString()}>{eventDate}</time></dd>
          </div>
          <div className="event-summary-banner__item event-summary-banner__item--time">
            <dt>Time</dt>
            <dd><time dateTime={new Date(event.starts_at).toISOString()}>{eventTime}–{endTime}</time></dd>
          </div>
          <div className="event-summary-banner__item event-summary-banner__item--venue">
            <dt>Venue</dt>
            <dd>{event.venue_name}</dd>
          </div>
        </dl>
        <TicketSelector
          eventId={event.id}
          eventTitle={event.title}
          signedIn={Boolean(user)}
          tiers={tierResult.rows.map((tier) => {
            const paid = Number(tier.paid_quantity);
            const reserved = Number(tier.reserved_quantity);
            const remaining = tier.capacity === null ? null : Math.max(0, tier.capacity - paid - reserved);
            const soldOut = tier.capacity !== null && (
              paid >= tier.capacity || (activeSortOrder !== undefined && tier.sort_order < activeSortOrder)
            );
            return {
              id: tier.id,
              name: tier.name,
              priceMinor: tier.price_minor,
              maxPerOrder: tier.max_per_order,
              remaining,
              active: tier.is_active && (remaining === null || remaining > 0),
              status: soldOut ? "sold_out" as const : tier.is_active && remaining === 0 ? "reserved" as const : tier.is_active ? "on_sale" as const : "upcoming" as const
            };
          })}
        />
      </article>
    </div>
  );
}
