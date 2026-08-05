import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export type FulfilledOrder = { orderId: string; userId: string; email: string; displayName: string };

export async function fulfilPaidOrder(client: PoolClient, orderId: string, paymentIntentId?: string | null) {
  const result = await client.query<{
    id: string;
    user_id: string;
    status: string;
    email: string;
    display_name: string;
  }>(
    `SELECT o.id, o.user_id, o.status, u.email, u.display_name
       FROM ticket_orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1 FOR UPDATE OF o`,
    [orderId]
  );
  const order = result.rows[0];
  if (!order) throw new Error("Ticket order not found");
  if (order.status === "paid") return null;
  if (order.status === "refunded") return null;

  await client.query(
    `UPDATE ticket_orders
        SET status = 'paid', stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
            paid_at = COALESCE(paid_at, now()), updated_at = now()
      WHERE id = $1`,
    [orderId, paymentIntentId ?? null]
  );

  const items = await client.query<{
    id: string;
    quantity: number;
    ticket_type_name: string;
    event_id: string;
  }>(
    `SELECT i.id, i.quantity, i.ticket_type_name, o.event_id
       FROM ticket_order_items i JOIN ticket_orders o ON o.id = i.order_id
      WHERE i.order_id = $1`,
    [orderId]
  );
  for (const item of items.rows) {
    for (let index = 0; index < item.quantity; index += 1) {
      const number = await client.query<{ value: string }>(
        "SELECT 'UFI-T-' || lpad(nextval('admission_ticket_number_seq')::text, 6, '0') AS value"
      );
      await client.query(
        `INSERT INTO tickets (
           id, public_id, ticket_number, order_id, order_item_id, user_id, event_id, ticket_type_name
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          randomUUID(), randomUUID(), number.rows[0].value, orderId, item.id,
          order.user_id, item.event_id, item.ticket_type_name
        ]
      );
    }
  }
  await client.query(
    `INSERT INTO ticket_audit_log (id, order_id, action, details)
     VALUES ($1, $2, 'order_paid', $3::jsonb)`,
    [randomUUID(), orderId, JSON.stringify({ paymentIntentId: paymentIntentId ?? null })]
  );
  return { orderId, userId: order.user_id, email: order.email, displayName: order.display_name } satisfies FulfilledOrder;
}

