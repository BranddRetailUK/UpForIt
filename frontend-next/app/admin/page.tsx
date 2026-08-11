import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminResendButton from "../../components/AdminResendButton";
import AdminScannerAccess from "../../components/AdminScannerAccess";
import AdminSimulatedPurchase from "../../components/AdminSimulatedPurchase";
import { getCurrentUser } from "../../lib/auth";
import { getPool } from "../../lib/db";
import { getMetaAdsSummary } from "../../lib/meta";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket admin", robots: { index: false, follow: false } };

type Metrics = { paid_orders: string; revenue_minor: string; issued_tickets: string; checked_in: string };
type Tier = { id: string; name: string; price_minor: number; capacity: number | null; max_per_order: number; sort_order: number; is_active: boolean; paid_quantity: string; pending_quantity: string };
type Order = { id: string; order_number: string | null; status: string; total_minor: number; created_at: Date; paid_at: Date | null; confirmation_email_sent_at: Date | null; email: string; display_name: string; event_title: string; ticket_count: string; checked_in_count: string; simulated: boolean };
type ScannerEvent = { id: string; title: string; starts_at: Date; ends_at: Date; timezone: string };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  if (user.role !== "admin") redirect(user.role === "staff" ? "/scan" : "/account");

  const [metricResult, tiers, orders, metaAds, scannerEvents] = await Promise.all([
    getPool().query<Metrics>(
      `SELECT
        (SELECT count(*) FROM ticket_orders WHERE status = 'paid')::text AS paid_orders,
        (SELECT COALESCE(sum(total_minor), 0) FROM ticket_orders WHERE status = 'paid')::text AS revenue_minor,
        (SELECT count(*) FROM tickets WHERE status <> 'void')::text AS issued_tickets,
        (SELECT count(*) FROM tickets WHERE status = 'checked_in')::text AS checked_in`
    ),
    getPool().query<Tier>(
      `SELECT tt.id, tt.name, tt.price_minor, tt.capacity, tt.max_per_order, tt.sort_order, tt.is_active,
        COALESCE(sum(i.quantity) FILTER (WHERE o.status = 'paid'), 0)::text AS paid_quantity,
        COALESCE(sum(i.quantity) FILTER (WHERE o.status = 'pending' AND o.reserved_until > now()), 0)::text AS pending_quantity
       FROM ticket_types tt
       LEFT JOIN ticket_order_items i ON i.ticket_type_id = tt.id
       LEFT JOIN ticket_orders o ON o.id = i.order_id
       GROUP BY tt.id ORDER BY tt.sort_order, tt.price_minor`
    ),
    getPool().query<Order>(
      `SELECT o.id, o.order_number, o.status, o.total_minor, o.created_at, o.paid_at,
              o.confirmation_email_sent_at, u.email, u.display_name, e.title AS event_title,
              count(t.id)::text AS ticket_count,
              count(t.id) FILTER (WHERE t.status = 'checked_in')::text AS checked_in_count,
              EXISTS (
                SELECT 1 FROM ticket_audit_log a
                 WHERE a.order_id = o.id AND a.action = 'admin_simulated_purchase'
              ) AS simulated
       FROM ticket_orders o JOIN users u ON u.id = o.user_id JOIN events e ON e.id = o.event_id
       LEFT JOIN tickets t ON t.order_id = o.id
       WHERE o.status <> 'expired'
       GROUP BY o.id, u.email, u.display_name, e.title
       ORDER BY o.created_at DESC LIMIT 100`
    ),
    getMetaAdsSummary(),
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

      <section className="admin-metrics" aria-label="Ticket metrics">
        <article><strong>{metrics.paid_orders}</strong><span>Paid orders</span></article>
        <article><strong>£{(Number(metrics.revenue_minor) / 100).toFixed(2)}</strong><span>Revenue</span></article>
        <article><strong>{metrics.issued_tickets}</strong><span>Issued tickets</span></article>
        <article><strong>{metrics.checked_in}</strong><span>Checked in</span></article>
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

      {user.role === "admin" && process.env.APP_ENV === "testing" ? (
        <section className="admin-panel admin-section--simulation">
          <AdminSimulatedPurchase tiers={tiers.rows.map((tier) => {
            const paid = Number(tier.paid_quantity);
            const remaining = tier.capacity === null ? null : Math.max(0, tier.capacity - paid);
            return {
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
        <div className="admin-table-wrap"><table className="admin-table admin-orders-table"><thead><tr><th className="admin-orders-col--order">Order</th><th className="admin-orders-col--buyer">Buyer</th><th className="admin-orders-col--status">Status</th><th className="admin-orders-col--mobile-hidden">Tickets</th><th className="admin-orders-col--mobile-hidden">Total</th><th className="admin-orders-col--mobile-hidden">Email</th><th className="admin-orders-col--mobile-hidden">Created</th><th className="admin-orders-col--mobile-hidden" /></tr></thead><tbody>
          {orders.rows.map((order) => <tr key={order.id}>
            <td className="admin-orders-col--order">{order.order_number ? <Link href={`/account/orders/${order.id}`}>{order.order_number}</Link> : <span>Pending checkout</span>}{order.simulated ? <small>Test simulation</small> : null}</td><td className="admin-orders-col--buyer">{order.display_name}<small>{order.email}</small></td>
            <td className="admin-orders-col--status"><div className="admin-order-statuses"><span className={`admin-status admin-status--${order.status}`}>{order.status}</span>{Number(order.checked_in_count) > 0 ? <span className="admin-status admin-status--scanned" title={`${order.checked_in_count} of ${order.ticket_count} tickets scanned`}>{Number(order.checked_in_count) === Number(order.ticket_count) ? "Scanned" : `${order.checked_in_count}/${order.ticket_count} scanned`}</span> : null}</div></td><td className="admin-orders-col--mobile-hidden">{order.ticket_count}</td><td className="admin-orders-col--mobile-hidden">£{(order.total_minor / 100).toFixed(2)}</td>
            <td className="admin-orders-col--mobile-hidden">{order.confirmation_email_sent_at ? "Sent" : order.status === "paid" ? "Queued/pending" : "—"}</td><td className="admin-orders-col--mobile-hidden">{new Date(order.created_at).toLocaleString("en-GB")}</td>
            <td className="admin-orders-col--mobile-hidden">{order.status === "paid" ? <AdminResendButton orderId={order.id} /> : null}</td>
          </tr>)}
        </tbody></table></div>
      </section>

      <section className="admin-panel admin-section--tiers">
        <h2>Ticket tiers</h2>
        <p className="admin-mobile-hidden">Sales advance automatically: 50 Early Bird tickets, then 100 General Release tickets, then unlimited On The Door tickets.</p>
        <div className="admin-table-wrap"><table className="admin-table admin-tier-table"><thead><tr><th className="admin-tier-col--tier">Tier</th><th className="admin-tier-col--price">Price</th><th className="admin-tier-col--capacity">Capacity</th><th className="admin-tier-col--paid">Paid</th><th className="admin-tier-col--pending">Open checkouts</th><th className="admin-tier-col--remaining">Remaining</th><th className="admin-tier-col--status">Status</th></tr></thead><tbody>
          {tiers.rows.map((tier) => {
            const paid = Number(tier.paid_quantity);
            const pending = Number(tier.pending_quantity);
            const remaining = tier.capacity === null ? null : Math.max(0, tier.capacity - paid);
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
          <div>
            <p className="comic-kicker comic-kicker--pink">Meta Marketing API</p>
            <h2>Ad performance</h2>
          </div>
          <a href="https://adsmanager.facebook.com/adsmanager/manage/campaigns" target="_blank" rel="noopener noreferrer">Open Ads Manager</a>
        </div>
        {metaAds.state === "ready" ? (
          <>
            <p className="meta-ads-panel__period">
              Last 30 days{metaAds.dateStart && metaAds.dateStop ? ` · ${metaAds.dateStart} to ${metaAds.dateStop}` : ""}
            </p>
            <div className="meta-ads-metrics" aria-label="Meta advertising metrics">
              <article><strong>£{metaAds.spend.toFixed(2)}</strong><span>Spend</span></article>
              <article><strong>{metaAds.reach.toLocaleString("en-GB")}</strong><span>Reach</span></article>
              <article><strong>{metaAds.impressions.toLocaleString("en-GB")}</strong><span>Impressions</span></article>
              <article><strong>{metaAds.linkClicks.toLocaleString("en-GB")}</strong><span>Link clicks</span></article>
              <article><strong>{metaAds.ctr.toFixed(2)}%</strong><span>CTR</span></article>
              <article><strong>£{metaAds.cpc.toFixed(2)}</strong><span>CPC</span></article>
              <article><strong>{metaAds.purchases.toLocaleString("en-GB")}</strong><span>Purchases</span></article>
              <article><strong>£{metaAds.purchaseValue.toFixed(2)}</strong><span>Purchase value</span></article>
              <article><strong>{metaAds.purchaseRoas.toFixed(2)}×</strong><span>Purchase ROAS</span></article>
              <article><strong>{metaAds.leads.toLocaleString("en-GB")}</strong><span>Leads</span></article>
            </div>
          </>
        ) : (
          <p className="form-message form-message--error">
            {metaAds.state === "not_configured"
              ? "Meta Ads reporting is not configured in this environment."
              : `Meta Ads reporting is temporarily unavailable${metaAds.status ? ` (API ${metaAds.status})` : ""}. Check or renew the Marketing API token.`}
          </p>
        )}
      </section>

    </div>
  );
}
