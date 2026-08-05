import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminResendButton from "../../components/AdminResendButton";
import AdminSimulatedPurchase from "../../components/AdminSimulatedPurchase";
import { getCurrentUser } from "../../lib/auth";
import { getPool } from "../../lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket admin", robots: { index: false, follow: false } };

type Metrics = { paid_orders: string; revenue_minor: string; issued_tickets: string; checked_in: string; accounts: string };
type Tier = { id: string; name: string; price_minor: number; capacity: number | null; max_per_order: number; sort_order: number; is_active: boolean; paid_quantity: string; reserved_quantity: string };
type Order = { id: string; order_number: string; status: string; total_minor: number; created_at: Date; paid_at: Date | null; confirmation_email_sent_at: Date | null; email: string; display_name: string; event_title: string; ticket_count: string; simulated: boolean };
type EmailJob = { id: string; job_type: string; status: string; attempts: number; last_error: string | null; created_at: Date; sent_at: Date | null };
type Webhook = { stripe_event_id: string; event_type: string; processed_at: Date | null; error_message: string | null; created_at: Date };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  if (user.role === "customer") redirect("/account");

  const [metricResult, tiers, orders, emailJobs, webhooks] = await Promise.all([
    getPool().query<Metrics>(
      `SELECT
        (SELECT count(*) FROM ticket_orders WHERE status = 'paid')::text AS paid_orders,
        (SELECT COALESCE(sum(total_minor), 0) FROM ticket_orders WHERE status = 'paid')::text AS revenue_minor,
        (SELECT count(*) FROM tickets WHERE status <> 'void')::text AS issued_tickets,
        (SELECT count(*) FROM tickets WHERE status = 'checked_in')::text AS checked_in,
        (SELECT count(*) FROM users WHERE disabled_at IS NULL)::text AS accounts`
    ),
    getPool().query<Tier>(
      `SELECT tt.id, tt.name, tt.price_minor, tt.capacity, tt.max_per_order, tt.sort_order, tt.is_active,
        COALESCE(sum(i.quantity) FILTER (WHERE o.status = 'paid'), 0)::text AS paid_quantity,
        COALESCE(sum(i.quantity) FILTER (WHERE o.status = 'pending' AND o.reserved_until > now()), 0)::text AS reserved_quantity
       FROM ticket_types tt
       LEFT JOIN ticket_order_items i ON i.ticket_type_id = tt.id
       LEFT JOIN ticket_orders o ON o.id = i.order_id
       GROUP BY tt.id ORDER BY tt.sort_order, tt.price_minor`
    ),
    getPool().query<Order>(
      `SELECT o.id, o.order_number, o.status, o.total_minor, o.created_at, o.paid_at,
              o.confirmation_email_sent_at, u.email, u.display_name, e.title AS event_title,
              count(t.id)::text AS ticket_count,
              EXISTS (
                SELECT 1 FROM ticket_audit_log a
                 WHERE a.order_id = o.id AND a.action = 'admin_simulated_purchase'
              ) AS simulated
       FROM ticket_orders o JOIN users u ON u.id = o.user_id JOIN events e ON e.id = o.event_id
       LEFT JOIN tickets t ON t.order_id = o.id
       GROUP BY o.id, u.email, u.display_name, e.title
       ORDER BY o.created_at DESC LIMIT 100`
    ),
    getPool().query<EmailJob>(
      `SELECT id, job_type, status, attempts, last_error, created_at, sent_at
       FROM email_jobs ORDER BY created_at DESC LIMIT 40`
    ),
    getPool().query<Webhook>(
      `SELECT stripe_event_id, event_type, processed_at, error_message, created_at
       FROM stripe_event_receipts ORDER BY created_at DESC LIMIT 40`
    )
  ]);
  const metrics = metricResult.rows[0];
  const activeSortOrder = tiers.rows.find((tier) => tier.is_active)?.sort_order;

  return (
    <div className="admin-shell section-wrap">
      <header className="admin-header">
        <div><p className="comic-kicker comic-kicker--yellow">Testing control centre</p><h1>Ticket admin</h1><p>Signed in as {user.email}</p></div>
        <nav><Link href="/admin/check-in">Open check-in</Link><Link href="/account">My account</Link></nav>
      </header>

      <section className="admin-metrics" aria-label="Ticket metrics">
        <article><strong>{metrics.paid_orders}</strong><span>Paid orders</span></article>
        <article><strong>£{(Number(metrics.revenue_minor) / 100).toFixed(2)}</strong><span>Revenue</span></article>
        <article><strong>{metrics.issued_tickets}</strong><span>Issued tickets</span></article>
        <article><strong>{metrics.checked_in}</strong><span>Checked in</span></article>
        <article><strong>{metrics.accounts}</strong><span>Accounts</span></article>
      </section>

      {user.role === "admin" ? (
        <section className="admin-panel">
          <AdminSimulatedPurchase tiers={tiers.rows.map((tier) => {
            const paid = Number(tier.paid_quantity);
            const reserved = Number(tier.reserved_quantity);
            const remaining = tier.capacity === null ? null : Math.max(0, tier.capacity - paid - reserved);
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

      <section className="admin-panel">
        <h2>Ticket tiers</h2>
        <p>Sales advance automatically: 50 Early Bird tickets, then 100 Tier 1 tickets, then unlimited Tier 2 tickets.</p>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Tier</th><th>Price</th><th>Capacity</th><th>Paid</th><th>Reserved</th><th>Remaining</th><th>Status</th></tr></thead><tbody>
          {tiers.rows.map((tier) => {
            const paid = Number(tier.paid_quantity);
            const reserved = Number(tier.reserved_quantity);
            const remaining = tier.capacity === null ? null : Math.max(0, tier.capacity - paid - reserved);
            const soldOut = tier.capacity !== null && (
              paid >= tier.capacity || (activeSortOrder !== undefined && tier.sort_order < activeSortOrder)
            );
            const status = soldOut ? "Sold out" : tier.is_active ? (remaining === 0 ? "Fully reserved" : "On sale") : "Coming next";
            return <tr key={tier.id}><td>{tier.name}</td><td>£{(tier.price_minor / 100).toFixed(2)}</td><td>{tier.capacity ?? "Unlimited"}</td><td>{paid}</td><td>{reserved}</td><td>{remaining ?? "Unlimited"}</td><td><span className={`admin-status${tier.is_active ? " admin-status--paid" : ""}`}>{status}</span></td></tr>;
          })}
        </tbody></table></div>
      </section>

      <section className="admin-panel">
        <h2>Latest orders</h2>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Buyer</th><th>Status</th><th>Tickets</th><th>Total</th><th>Email</th><th>Created</th><th /></tr></thead><tbody>
          {orders.rows.map((order) => <tr key={order.id}>
            <td><Link href={`/account/orders/${order.id}`}>{order.order_number}</Link>{order.simulated ? <small>Test simulation</small> : null}</td><td>{order.display_name}<small>{order.email}</small></td>
            <td><span className={`admin-status admin-status--${order.status}`}>{order.status}</span></td><td>{order.ticket_count}</td><td>£{(order.total_minor / 100).toFixed(2)}</td>
            <td>{order.confirmation_email_sent_at ? "Sent" : order.status === "paid" ? "Queued/pending" : "—"}</td><td>{new Date(order.created_at).toLocaleString("en-GB")}</td>
            <td>{order.status === "paid" ? <AdminResendButton orderId={order.id} /> : null}</td>
          </tr>)}
        </tbody></table></div>
      </section>

      <section className="admin-panel">
        <h2>Email delivery</h2>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th><th>Error</th></tr></thead><tbody>
          {emailJobs.rows.map((job) => <tr key={job.id}><td>{job.job_type.replace(/_/g, " ")}</td><td>{job.status}</td><td>{job.attempts}</td><td>{new Date(job.created_at).toLocaleString("en-GB")}</td><td className="admin-error">{job.last_error || "—"}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="admin-panel">
        <h2>Stripe webhooks</h2>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Event</th><th>Type</th><th>Received</th><th>Result</th></tr></thead><tbody>
          {webhooks.rows.map((event) => <tr key={event.stripe_event_id}><td>{event.stripe_event_id}</td><td>{event.event_type}</td><td>{new Date(event.created_at).toLocaleString("en-GB")}</td><td className="admin-error">{event.error_message || (event.processed_at ? "Processed" : "Pending")}</td></tr>)}
        </tbody></table></div>
      </section>
    </div>
  );
}
