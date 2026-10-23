import TicketSelector from "./TicketSelector";
import { getPool } from "../lib/db";
import { getCurrentUser } from "../lib/auth";
import { publicTicketSalesOpen } from "../lib/event-visibility";

export default async function NyeTickets({ preview }: { preview: boolean }) {
  const user = await getCurrentUser();
  if (preview) return <TicketSelector eventId="nye-preview" eventSlug="nye-2026" eventTitle="NYE 2026" signedIn={Boolean(user)} preview tiers={[{ id: "nye-general", name: "General admission", priceMinor: 1000, maxPerOrder: 10, remaining: null, active: true, status: "on_sale" }]} />;
  if (!publicTicketSalesOpen() || process.env.TICKETING_ENABLED !== "true") return null;
  const result = await getPool().query<{ event_id: string; id: string; name: string; max_per_order: number }>(
    `SELECT e.id AS event_id, tt.id, tt.name, tt.max_per_order FROM events e
     JOIN ticket_types tt ON tt.event_id = e.id
     WHERE e.slug = 'nye-2026' AND e.status = 'published' AND e.sales_open = true AND e.ends_at > now()
       AND tt.archived_at IS NULL AND tt.is_active = true AND tt.price_minor = 1000
       AND tt.currency = 'gbp' AND tt.capacity IS NULL
       AND (tt.sales_start_at IS NULL OR tt.sales_start_at <= now())
       AND (tt.sales_end_at IS NULL OR tt.sales_end_at > now())`
  );
  if (result.rows.length !== 1) return <section id="tickets" className="ticket-selector"><h2>Tickets coming soon</h2><p>£10 admission. Buy 3 tickets and get the 4th free.</p></section>;
  const tier = result.rows[0];
  return <TicketSelector key={tier.id} eventId={tier.event_id} eventSlug="nye-2026" eventTitle="NYE 2026" signedIn={Boolean(user)} tiers={[{ id: tier.id, name: tier.name, priceMinor: 1000, maxPerOrder: tier.max_per_order, remaining: null, active: true, status: "on_sale" }]} />;
}
