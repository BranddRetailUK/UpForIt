import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket order", robots: { index: false } };

type OrderRow = {
  id: string; order_number: string; status: string; total_minor: number; created_at: Date;
  event_title: string; venue_name: string; starts_at: Date; timezone: string;
};
type TicketRow = { id: string; ticket_number: string; ticket_type_name: string; status: string; checked_in_at: Date | null };

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  const orderResult = await getPool().query<OrderRow>(
    `SELECT o.id, o.order_number, o.status, o.total_minor, o.created_at,
            e.title AS event_title, e.venue_name, e.starts_at, e.timezone
       FROM ticket_orders o JOIN events e ON e.id = o.event_id
      WHERE o.id = $1 AND (o.user_id = $2 OR $3 = true)`,
    [orderId, user.id, user.role !== "customer"]
  );
  const order = orderResult.rows[0];
  if (!order) notFound();
  const tickets = await getPool().query<TicketRow>(
    "SELECT id, ticket_number, ticket_type_name, status, checked_in_at FROM tickets WHERE order_id = $1 ORDER BY created_at",
    [order.id]
  );

  return (
    <div className="inner-page section-wrap account-page">
      <section className="account-panel account-panel--wide">
        <Link href="/account">← Back to account</Link>
        <p className="comic-kicker comic-kicker--yellow">{order.order_number}</p>
        <h1>{order.event_title}</h1>
        <p>{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: order.timezone }).format(new Date(order.starts_at))} · {order.venue_name}</p>
        <p><strong>Status:</strong> {order.status} · <strong>Total:</strong> £{(order.total_minor / 100).toFixed(2)}</p>
        {order.status === "paid" ? <a className="pop-button pop-button--yellow" href={`/api/tickets/orders/${order.id}/pdf`}>Download printable tickets</a> : null}
        <div className="ticket-wallet">
          {tickets.rows.map((ticket) => (
            <article className="ticket-wallet__ticket" key={ticket.id}>
              <div><strong>{ticket.ticket_type_name}</strong><small>{ticket.ticket_number} · {ticket.status.replace("_", " ")}</small></div>
              {ticket.status !== "void" ? <img src={`/api/tickets/${ticket.id}/qr`} alt={`QR code for ${ticket.ticket_number}`} width={220} height={220} /> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
