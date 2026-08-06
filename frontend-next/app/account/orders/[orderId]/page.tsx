import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket order", robots: { index: false } };

type OrderRow = {
  id: string; order_number: string; status: string;
  event_title: string; venue_name: string; starts_at: Date; timezone: string;
};
type TicketRow = { id: string; ticket_number: string; ticket_type_name: string; status: string };

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  const orderResult = await getPool().query<OrderRow>(
    `SELECT o.id, o.order_number, o.status,
            e.title AS event_title, e.venue_name, e.starts_at, e.timezone
       FROM ticket_orders o JOIN events e ON e.id = o.event_id
      WHERE o.id = $1 AND (o.user_id = $2 OR $3 = true)`,
    [orderId, user.id, user.role !== "customer"]
  );
  const order = orderResult.rows[0];
  if (!order) notFound();
  const tickets = await getPool().query<TicketRow>(
    "SELECT id, ticket_number, ticket_type_name, status FROM tickets WHERE order_id = $1 ORDER BY created_at",
    [order.id]
  );

  return (
    <div className="inner-page section-wrap account-page account-order-page">
      <section className="account-panel account-panel--wide account-order-panel">
        <p className="comic-kicker comic-kicker--yellow account-order__number">{order.order_number}</p>
        <h1>{order.event_title}</h1>
        <p className="account-order__event-details">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: order.timezone }).format(new Date(order.starts_at))} · {order.venue_name}</p>
        {order.status === "paid" ? <a className="pop-button pop-button--yellow account-order__download" href={`/api/tickets/orders/${order.id}/pdf`}>{tickets.rows.length === 1 ? "Download ticket" : `Download all ${tickets.rows.length} tickets (PDF)`}</a> : null}
        <div className="ticket-wallet">
          {tickets.rows.map((ticket, index) => (
            <article className="ticket-wallet__ticket" key={ticket.id} aria-label={`Ticket ${index + 1} of ${tickets.rows.length}`}>
              <div className="ticket-wallet__copy">
                <span className="ticket-wallet__position">Ticket {index + 1} of {tickets.rows.length}</span>
                <strong>{ticket.ticket_type_name}</strong>
                <small>{ticket.ticket_number}</small>
              </div>
              {ticket.status !== "void" ? <img src={`/api/tickets/${ticket.id}/qr`} alt={`QR code for ${ticket.ticket_number}`} width={260} height={260} loading={index > 3 ? "lazy" : "eager"} /> : <strong className="ticket-wallet__void">Void</strong>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
