import { UUID_PATTERN } from "../../lib/ticket-checkout-input";
import AdminNavigation from "../../components/AdminNavigation";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminMetaAdsAnalytics from "../../components/AdminMetaAdsAnalytics";
import AdminResendButton from "../../components/AdminResendButton";
import AdminScannerAccess from "../../components/AdminScannerAccess";
import AdminSimulatedPurchase from "../../components/AdminSimulatedPurchase";
import { getCurrentUser } from "../../lib/auth";
import { getPool } from "../../lib/db";
import { getMetaAdsAnalytics } from "../../lib/meta";
import { getTicketEmailStatus } from "../../lib/ticket-email-status";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket admin", robots: { index: false, follow: false } };

type Metrics = { paid_orders: string; revenue_minor: string; issued_tickets: string; checked_in: string };
type Tier = { event_slug:string; id: string; name: string; price_minor: number; capacity: number | null; max_per_order: number; sort_order: number; is_active: boolean; paid_quantity: string; pending_quantity: string };
type Order = { refunded_minor:number; admissions_hold:boolean; free_count:string; event_id:string; id: string; order_number: string | null; status: string; total_minor: number; created_at: Date; paid_at: Date | null; confirmation_email_sent_at: Date | null; confirmation_email_status: string | null; confirmation_email_attempts: number | null; confirmation_email_error: string | null; email: string; display_name: string; event_title: string; ticket_count: string; checked_in_count: string; simulated: boolean };
type ScannerEvent = { id: string; title: string; starts_at: Date; ends_at: Date; timezone: string };

const adminDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London"
});

export default async function AdminPage({searchParams}:{searchParams:Promise<{event?:string;page?:string;q?:string}>}) {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  if (user.role !== "admin") redirect(user.role === "staff" ? "/scan" : "/account");

  const filters=await searchParams;
  const eventList=(await getPool().query<{id:string;title:string;slug:string}>('SELECT id,title,slug FROM events ORDER BY starts_at DESC')).rows;
  const eventId=filters.event==='all'?null:filters.event&&UUID_PATTERN.test(filters.event)?filters.event:eventList.find(e=>e.slug==='nye-2026')?.id??null;
  const page=Math.max(1,Math.min(100000,Number.parseInt(filters.page||'1')||1));
  const search=(filters.q||'').slice(0,100);
  const [metricResult, tiers, orders, metaAds, scannerEvents] = await Promise.all([
    getPool().query<Metrics>(
      `SELECT
        (SELECT count(*) FROM ticket_orders WHERE paid_at IS NOT NULL AND ($1::uuid IS NULL OR event_id=$1))::text AS paid_orders,
        (SELECT COALESCE(sum(total_minor-refunded_minor), 0) FROM ticket_orders WHERE paid_at IS NOT NULL AND ($1::uuid IS NULL OR event_id=$1))::text AS revenue_minor,
        (SELECT count(*) FROM tickets WHERE status <> 'void' AND ($1::uuid IS NULL OR event_id=$1))::text AS issued_tickets,
        (SELECT count(*) FROM tickets WHERE status = 'checked_in' AND ($1::uuid IS NULL OR event_id=$1))::text AS checked_in`, [eventId]
    ),
    getPool().query<Tier>(
      `SELECT (SELECT slug FROM events WHERE id=tt.event_id) AS event_slug, tt.id, tt.name, tt.price_minor, tt.capacity, tt.max_per_order, tt.sort_order, tt.is_active,
        COALESCE(sum(i.quantity) FILTER (WHERE o.status IN ('paid','refund_review')), 0)::text AS paid_quantity,
        COALESCE(sum(i.quantity) FILTER (WHERE o.status = 'pending'), 0)::text AS pending_quantity
       FROM ticket_types tt
       LEFT JOIN ticket_order_items i ON i.ticket_type_id = tt.id
       LEFT JOIN ticket_orders o ON o.id = i.order_id
       WHERE tt.archived_at IS NULL AND ($1::uuid IS NULL OR tt.event_id=$1)
       GROUP BY tt.id ORDER BY tt.sort_order, tt.price_minor`, [eventId]
    ),
    getPool().query<Order>(
      `SELECT o.id, o.order_number, o.status, o.total_minor, o.refunded_minor, o.admissions_hold, o.event_id,
              (SELECT COALESCE(sum(quantity),0)::text FROM ticket_order_items WHERE order_id=o.id AND unit_price_minor=0) AS free_count, o.created_at, o.paid_at,
              o.confirmation_email_sent_at,
              confirmation_email.status AS confirmation_email_status,
              confirmation_email.attempts AS confirmation_email_attempts,
              confirmation_email.last_error AS confirmation_email_error,
              u.email, u.display_name, e.title AS event_title,
              count(t.id)::text AS ticket_count,
              count(t.id) FILTER (WHERE t.status = 'checked_in')::text AS checked_in_count,
              EXISTS (
                SELECT 1 FROM ticket_audit_log a
                 WHERE a.order_id = o.id AND a.action = 'admin_simulated_purchase'
              ) AS simulated
       FROM ticket_orders o JOIN users u ON u.id = o.user_id JOIN events e ON e.id = o.event_id
       LEFT JOIN LATERAL (
         SELECT j.status, j.attempts, j.last_error
           FROM email_jobs j
          WHERE j.order_id = o.id AND j.job_type = 'ticket_confirmation'
          ORDER BY j.created_at DESC
          LIMIT 1
       ) confirmation_email ON true
       LEFT JOIN tickets t ON t.order_id = o.id
       WHERE ($1::uuid IS NULL OR o.event_id=$1) AND ($2='' OR u.email ILIKE '%'||$2||'%' OR o.order_number ILIKE '%'||$2||'%')
       GROUP BY o.id, u.email, u.display_name, e.title,
                confirmation_email.status, confirmation_email.attempts, confirmation_email.last_error
       ORDER BY o.created_at DESC,o.id DESC LIMIT 100 OFFSET $3`, [eventId,search,(page-1)*100]
    ),
    getMetaAdsAnalytics(),
    getPool().query<ScannerEvent>(
      `SELECT id, title, starts_at, ends_at, timezone
         FROM events
        WHERE status <> 'cancelled' AND ends_at + interval '2 hours' > now()
        ORDER BY starts_at`
    )
  ]);
  const metrics = metricResult.rows[0];
  const activeSortOrder = tiers.rows.find((tier) => tier.is_active)?.sort_order;

  return (
    <div className="admin-shell admin-dashboard section-wrap">
      <header className="admin-header">
        <div><p className="comic-kicker comic-kicker--yellow">{process.env.APP_ENV === "testing" ? "Testing control centre" : "Operations control centre"}</p><h1>Ticket admin</h1><p>Signed in as {user.email}</p></div>
        <nav>
          <Link className="admin-header__check-in" href="/scan"><span className="admin-label--desktop">Open check-in</span><span className="admin-label--mobile">Scan QR</span></Link>
          <Link className="admin-header__account-link" href="/account">My account</Link>
        </nav>
      </header>

      <AdminNavigation active="tickets" />
      <form method="get"><label>Event <select name="event" defaultValue={eventId??'all'}><option value="all">All events</option>{eventList.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label> <label>Order or email <input name="q" defaultValue={search}/></label> <button>Filter orders</button></form>
      <section className="admin-metrics" aria-label="Ticket metrics">
        <article><strong>{metrics.paid_orders}</strong><span>Paid orders</span></article>
        <article><strong>£{(Number(metrics.revenue_minor) / 100).toFixed(2)}</strong><span>Net receipts after refunds</span></article>
        <article><strong>{metrics.issued_tickets}</strong><span>Issued tickets</span></article>
        <article><strong>{metrics.checked_in}</strong><span>Checked in</span></article>
      </section>

      {user.role === "admin" && process.env.APP_ENV === "testing" ? (
        <section className="admin-panel admin-section--simulation">
          <AdminSimulatedPurchase tiers={tiers.rows.map((tier) => {
            const paid = Number(tier.paid_quantity);
            const remaining = tier.capacity === null ? null : Math.max(0, tier.capacity - paid - Number(tier.pending_quantity));
            return {
              eventSlug:tier.event_slug,
              id: tier.id,
              name: tier.name,
              priceMinor: tier.price_minor,
              maxPerOrder: tier.max_per_order,
              remaining,
              available: tier.is_active && (remaining === null || remaining > 0)
            };
          })} />
        </section>
      ) : null}

      <section className="admin-panel admin-section--orders">
        <h2>Ticket Purchases</h2>
        <div className="admin-table-wrap"><table className="admin-table admin-orders-table"><thead><tr><th className="admin-orders-col--order">Order</th><th className="admin-orders-col--buyer">Buyer</th><th className="admin-orders-col--status">Status</th><th className="admin-orders-col--scanned">Scanned</th><th className="admin-orders-col--mobile-hidden">Tickets</th><th className="admin-orders-col--mobile-hidden">Net paid</th><th className="admin-orders-col--mobile-hidden">Email</th><th className="admin-orders-col--mobile-hidden">Created</th><th className="admin-orders-col--mobile-hidden" /></tr></thead><tbody>
          {orders.rows.map((order) => {
            const emailStatus = getTicketEmailStatus({
              orderStatus: order.status,
              sentAt: order.confirmation_email_sent_at,
              jobStatus: order.confirmation_email_status,
              attempts: order.confirmation_email_attempts
            });
            const emailStatusTitle = emailStatus.label === "Failed" && order.confirmation_email_error
              ? order.confirmation_email_error
              : undefined;
            const checkedInCount = Number(order.checked_in_count);
            const ticketCount = Number(order.ticket_count);
            const scannedTitle = `${checkedInCount} of ${ticketCount} tickets scanned`;
            return <tr key={order.id}>
              <td className="admin-orders-col--order">{order.order_number ? <Link href={`/account/orders/${order.id}`}>{order.order_number}</Link> : <span>Pending checkout</span>}{order.simulated ? <small>Test simulation</small> : null}</td><td className="admin-orders-col--buyer">{order.display_name}<small>{order.email}</small></td>
              <td className="admin-orders-col--status"><div className="admin-order-statuses"><span className={`admin-status admin-status--${order.status}`}>{order.status}</span><span className={`admin-status admin-email-status--mobile admin-status--email-${emailStatus.tone}`} title={emailStatusTitle}>Email: {emailStatus.label}</span></div></td>
              <td className="admin-orders-col--scanned">{checkedInCount > 0 ? <span className="admin-scanned-check" title={scannedTitle} aria-label={scannedTitle}>✓</span> : null}</td>
              <td className="admin-orders-col--mobile-hidden">{order.ticket_count} ({order.free_count} free)</td><td className="admin-orders-col--mobile-hidden">£{((order.total_minor-order.refunded_minor) / 100).toFixed(2)}</td>
              <td className="admin-orders-col--mobile-hidden"><span className={`admin-status admin-status--email-${emailStatus.tone}`} title={emailStatusTitle}>{emailStatus.label}</span></td><td className="admin-orders-col--mobile-hidden">{adminDateTimeFormatter.format(new Date(order.created_at))}</td>
              <td className="admin-orders-col--mobile-hidden">{!order.admissions_hold && ["paid","refund_review"].includes(order.status) ? <AdminResendButton orderId={order.id} /> : null}</td>
            </tr>;
          })}
        </tbody></table></div>
        <nav aria-label="Order pages">{page>1?<Link href={`/admin?event=${eventId??'all'}&q=${encodeURIComponent(search)}&page=${page-1}`}>Previous page</Link>:null} <span>Page {page}</span> {orders.rows.length===100?<Link href={`/admin?event=${eventId??'all'}&q=${encodeURIComponent(search)}&page=${page+1}`}>Next page</Link>:null} <Link href={`/api/admin/tickets/export?event=${eventId??'all'}`}>Export event orders CSV</Link></nav>
      </section>

      <section className="admin-panel admin-section--tiers">
        <h2>Ticket pricing</h2>
        <div className="admin-table-wrap"><table className="admin-table admin-tier-table"><thead><tr><th className="admin-tier-col--tier">Tier</th><th className="admin-tier-col--price">Price</th><th className="admin-tier-col--capacity">Capacity</th><th className="admin-tier-col--paid">Paid</th><th className="admin-tier-col--pending">Open checkouts</th><th className="admin-tier-col--remaining">Remaining</th><th className="admin-tier-col--status">Status</th></tr></thead><tbody>
          {tiers.rows.map((tier) => {
            const paid = Number(tier.paid_quantity);
            const pending = Number(tier.pending_quantity);
            const remaining = tier.capacity === null ? null : Math.max(0, tier.capacity - paid - Number(tier.pending_quantity));
            const soldOut = tier.capacity !== null && (
              paid >= tier.capacity || (activeSortOrder !== undefined && tier.sort_order < activeSortOrder)
            );
            const status = soldOut ? "Sold out" : tier.is_active ? "On sale" : "Coming next";
            return <tr key={tier.id}><td className="admin-tier-col--tier">{tier.name}</td><td className="admin-tier-col--price">£{(tier.price_minor / 100).toFixed(2)}</td><td className="admin-tier-col--capacity">{tier.capacity ?? "Unlimited"}</td><td className="admin-tier-col--paid">{paid}</td><td className="admin-tier-col--pending">{pending}</td><td className="admin-tier-col--remaining">{remaining ?? "Unlimited"}</td><td className="admin-tier-col--status"><span className={`admin-status${tier.is_active ? " admin-status--paid" : ""}`}>{status}</span></td></tr>;
          })}
        </tbody></table></div>
      </section>

      <section className="admin-panel meta-ads-panel admin-section--ads">
        <div className="meta-ads-panel__header">
          <h2>Ad performance</h2>
          <a href="https://adsmanager.facebook.com/adsmanager/manage/campaigns" target="_blank" rel="noopener noreferrer">Open Ads Manager</a>
        </div>
        {metaAds.state === "ready" ? (
          <AdminMetaAdsAnalytics all={metaAds.all} campaigns={metaAds.campaigns} />
        ) : (
          <p className="form-message form-message--error">
            {metaAds.state === "not_configured"
              ? "Meta Ads reporting is not configured in this environment."
              : `Meta Ads reporting is temporarily unavailable${metaAds.status ? ` (API ${metaAds.status})` : ""}. Check or renew the Marketing API token.`}
          </p>
        )}
      </section>

      <section className="admin-panel admin-section--scanner">
        <AdminScannerAccess events={scannerEvents.rows.map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: new Date(event.starts_at).toISOString(),
          endsAt: new Date(event.ends_at).toISOString(),
          timezone: event.timezone
        }))} />
      </section>

    </div>
  );
}
