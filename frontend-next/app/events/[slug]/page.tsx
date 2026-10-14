import { PAST_EVENTS } from "../../../lib/past-events";
import EventArchive from "../../../components/EventArchive";
import EventsPage from "../page";
import { publicTicketSalesOpen } from "../../../lib/event-visibility";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TicketSelector from "../../../components/TicketSelector";
import { getCurrentUser } from "../../../lib/auth";
import { cloudinaryUrl } from "../../../lib/cloudinary";
import { getPool } from "../../../lib/db";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string; title: string; venue_name: string; starts_at: Date; ends_at: Date; timezone: string;
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
};

function formatEventTime(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone
  }).formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  if (hour === 12 && minute === 0) return "Noon";
  if (hour === 0 && minute === 0) return "Midnight";

  const displayHour = hour % 12 || 12;
  const displayMinute = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  return `${displayHour}${displayMinute}${hour < 12 ? "AM" : "PM"}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const archived = PAST_EVENTS.find(event => event.slug === slug);
  if (!archived) return { title: "Event" };
  return { title: `${archived.title} — Past event`, description: `${archived.title}, ${archived.dateLabel}. Original flyer and lineup.`, alternates: { canonical: `/events/${slug}` }, openGraph: { images: [{ url: cloudinaryUrl(archived.flyer, { width: 1200 }), alt: archived.title }] } };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const archived = PAST_EVENTS.find(event => event.slug === slug);
  if (archived) return <EventArchive event={archived} />;
  if (!publicTicketSalesOpen()) return <EventsPage />;
  const eventResult = await getPool().query<EventRow>(
    `SELECT id, title, venue_name, starts_at, ends_at, timezone
       FROM events WHERE slug = $1 AND status = 'published'`,
    [slug]
  );
  const event = eventResult.rows[0];
  if (!event) notFound();
  const [tierResult, user] = await Promise.all([
    getPool().query<TierRow>(
      `SELECT tt.id, tt.name, tt.price_minor, tt.max_per_order, tt.capacity, tt.sort_order, tt.is_active,
              COALESCE(sum(i.quantity) FILTER (WHERE o.status = 'paid'), 0)::text AS paid_quantity
         FROM ticket_types tt
         LEFT JOIN ticket_order_items i ON i.ticket_type_id = tt.id
         LEFT JOIN ticket_orders o ON o.id = i.order_id
        WHERE tt.event_id = $1 AND tt.archived_at IS NULL
        GROUP BY tt.id
        ORDER BY tt.sort_order, tt.price_minor`,
      [event.id]
    ),
    getCurrentUser()
  ]);
  const eventDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: event.timezone }).format(new Date(event.starts_at));
  const eventTime = formatEventTime(event.starts_at, event.timezone);
  const endTime = formatEventTime(event.ends_at, event.timezone);
  const activeSortOrder = tierResult.rows.find((tier) => tier.is_active)?.sort_order;
  return (
    <div className="inner-page section-wrap event-detail-page">
      <article className="event-ticket-detail">
        <header><h1>{event.title}</h1><p>{eventDate} · {eventTime}–{endTime}</p><p>{event.venue_name}</p></header>
        <TicketSelector
          eventId={event.id}
          eventSlug={slug}
          eventTitle={event.title}
          signedIn={Boolean(user)}
          tiers={tierResult.rows.map((tier) => {
            const paid = Number(tier.paid_quantity);
            const remaining = tier.capacity === null ? null : Math.max(0, tier.capacity - paid);
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
              status: soldOut ? "sold_out" as const : tier.is_active ? "on_sale" as const : "upcoming" as const
            };
          })}
        />
      </article>
    </div>
  );
}
