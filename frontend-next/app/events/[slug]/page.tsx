import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CloudinaryImage from "../../../components/CloudinaryImage";
import TicketSelector from "../../../components/TicketSelector";
import { getCurrentUser } from "../../../lib/auth";
import { CLOUDINARY_ASSETS, cloudinaryUrl } from "../../../lib/cloudinary";
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
  if (slug !== "summer-roundup-2026") return { title: "Event" };
  return { title: "The Summer Roundup tickets", description: "Buy tickets for The Summer Roundup on 26 September 2026." };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
        WHERE tt.event_id = $1
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
  const eventBackground = cloudinaryUrl(CLOUDINARY_ASSETS.summerRoundupBackground, { width: 1800 });

  return (
    <div className="inner-page section-wrap event-detail-page summer-roundup-page">
      <article
        className="summer-roundup-event"
        style={{ backgroundImage: `linear-gradient(rgba(0, 142, 240, .12), rgba(0, 101, 217, .18)), url("${eventBackground}")` }}
      >
        <header className="summer-roundup-hero">
          <p className="summer-roundup-genres" aria-label="Music genres">
            <span>UKG</span><i aria-hidden="true" />
            <span>Drum &amp; Bass</span><i aria-hidden="true" />
            <span>Electro</span><i aria-hidden="true" />
            <span>Breaks</span><i aria-hidden="true" />
            <span>Dance</span><i aria-hidden="true" />
            <span>Hardcore</span>
          </p>

          <div className="summer-roundup-hero__art">
            <CloudinaryImage
              asset={CLOUDINARY_ASSETS.summerRoundupCloud}
              alt=""
              className="summer-roundup-sticker summer-roundup-sticker--cloud"
              sizes="(max-width: 720px) 90px, 150px"
              maxWidth={329}
            />
            <div className="summer-roundup-hero__lockup">
              <CloudinaryImage
                asset={CLOUDINARY_ASSETS.summerRoundupPresents}
                alt="UPFORIT presents"
                className="summer-roundup-hero__presents"
                sizes="(max-width: 720px) 60vw, 420px"
                maxWidth={840}
                priority
              />
              <h1>
                <CloudinaryImage
                  asset={CLOUDINARY_ASSETS.summerRoundupTitle}
                  alt={event.title}
                  className="summer-roundup-hero__title"
                  sizes="(max-width: 720px) 92vw, 760px"
                  maxWidth={1476}
                  priority
                />
              </h1>
            </div>
            <CloudinaryImage
              asset={CLOUDINARY_ASSETS.summerRoundupLightning}
              alt=""
              className="summer-roundup-sticker summer-roundup-sticker--lightning"
              sizes="(max-width: 720px) 66px, 105px"
              maxWidth={250}
            />
          </div>
        </header>

        <section className="summer-roundup-lineup" aria-labelledby="summer-roundup-lineup-title">
          <p className="summer-roundup-lineup__label" aria-hidden="true">The full lineup</p>
          <h2 className="sr-only" id="summer-roundup-lineup-title">The full lineup</h2>
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.summerRoundupLineup}
            alt="Road 23, Spektral, Scott Charles, Haribo, Ectomorph, Sinik, Tommo, Savage, Slumberjack, Deechase, Bandy and Jack Panic"
            className="summer-roundup-lineup__artists"
            sizes="(max-width: 720px) 88vw, 940px"
            maxWidth={1200}
          />
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.summerRoundupMcs}
            alt="MCs on the day: E Dappa, Danzee, Razor and Treble"
            className="summer-roundup-lineup__mcs"
            sizes="(max-width: 720px) 88vw, 940px"
            maxWidth={1200}
          />
          <div className="summer-roundup-powered-by">
            <CloudinaryImage
              asset={CLOUDINARY_ASSETS.summerRoundupRevolt}
              alt="Revolt Sound System"
              className="summer-roundup-powered-by__logo"
              sizes="(max-width: 720px) 180px, 260px"
              maxWidth={520}
            />
          </div>
        </section>

        <dl className="summer-roundup-info" aria-label="Event details">
          <div className="summer-roundup-info__item summer-roundup-info__item--date">
            <dt>Date</dt>
            <dd><time dateTime={new Date(event.starts_at).toISOString()}>{eventDate}</time></dd>
          </div>
          <div className="summer-roundup-info__item summer-roundup-info__item--time">
            <dt>Time</dt>
            <dd><time dateTime={new Date(event.starts_at).toISOString()}>{eventTime}–{endTime}</time></dd>
          </div>
          <div className="summer-roundup-info__item summer-roundup-info__item--venue">
            <dt>Venue</dt>
            <dd>{event.venue_name}<small>4 Chandos Place, Bletchley, MK2 2SN</small></dd>
          </div>
        </dl>

        <TicketSelector
          eventId={event.id}
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
