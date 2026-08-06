import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import LogoutButton from "../../components/LogoutButton";
import { getCurrentUser } from "../../lib/auth";
import { getPool } from "../../lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false } };

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total_minor: number;
  created_at: Date;
  event_title: string;
  ticket_count: string;
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  const orders = await getPool().query<OrderRow>(
    `SELECT o.id, o.order_number, o.status, o.total_minor, o.created_at,
            e.title AS event_title, count(t.id)::text AS ticket_count
       FROM ticket_orders o
       JOIN events e ON e.id = o.event_id
       LEFT JOIN tickets t ON t.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id, e.title
      ORDER BY o.created_at DESC`,
    [user.id]
  );

  return (
    <div className="inner-page section-wrap account-page account-dashboard-page">
      <section className="account-panel account-panel--wide">
        <div className="account-heading">
          <div><p className="comic-kicker comic-kicker--yellow">Your backstage pass</p><h1>Hi, {user.displayName}</h1></div>
        </div>
        <p>{user.email}</p>
        <div className="account-actions">
          <Link className="pop-button pop-button--yellow" href="/events/summer-roundup-2026#tickets">Buy tickets</Link>
          {user.role === "admin" ? <Link className="pop-button pop-button--pink" href="/admin">Open ticket admin</Link> : null}
          {user.role !== "customer" ? <Link className="pop-button pop-button--pink" href="/staff/events">Open staff tools</Link> : null}
        </div>
        <h2>Your ticket orders</h2>
        {orders.rows.length ? (
          <div className="order-list">
            {orders.rows.map((order) => (
              <Link href={`/account/orders/${order.id}`} className="order-list__item" key={order.id}>
                <span><strong>{order.event_title}</strong><small>{order.order_number} · {new Date(order.created_at).toLocaleDateString("en-GB")}</small></span>
                <span>{order.status} · {order.ticket_count} ticket{order.ticket_count === "1" ? "" : "s"} · £{(order.total_minor / 100).toFixed(2)}</span>
              </Link>
            ))}
          </div>
        ) : <p>You don’t have any ticket orders yet. <Link href="/events">See events</Link>.</p>}
        <div className="account-logout">
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
