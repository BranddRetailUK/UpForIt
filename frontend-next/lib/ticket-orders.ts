import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { grantTicketMerchDiscount } from "./merch-discounts";
import { advanceTicketTierProgression } from "./ticket-tiers";

export type FulfilledOrder = {
  orderId: string;
  orderNumber: string;
  userId: string;
  email: string;
  displayName: string;
  totalMinor: number;
  currency: string;
  eventTitle: string;
  eventSlug: string;
  metaConsentGranted: boolean;
  metaPurchaseEventId: string | null;
  metaContextEncrypted: string | null;
  contents: Array<{ id: string; quantity: number; itemPriceMinor: number }>;
};

export async function fulfilPaidOrder(
  client: PoolClient,
  orderId: string,
  paymentIntentId?: string | null,
  source: "stripe" | "admin_simulation" = "stripe"
) {
  const result = await client.query<{
    id: string;
    order_number: string | null;
    user_id: string;
    status: string;
    email: string;
    display_name: string;
    total_minor: number;
    currency: string;
    event_title: string;
    event_slug: string;
    meta_consent_granted: boolean;
    meta_purchase_event_id: string | null;
    meta_context_encrypted: string | null;
  }>(
    `SELECT o.id, o.order_number, o.user_id, o.status, o.total_minor, o.currency,
            o.meta_consent_granted, o.meta_purchase_event_id, o.meta_context_encrypted,
            u.email, u.display_name, e.title AS event_title, e.slug AS event_slug
       FROM ticket_orders o
       JOIN users u ON u.id = o.user_id
       JOIN events e ON e.id = o.event_id
      WHERE o.id = $1 FOR UPDATE OF o`,
    [orderId]
  );
  const order = result.rows[0];
  if (!order) throw new Error("Ticket order not found");
  if (order.status === "paid") return null;
  if (order.status === "refunded") return null;

  let orderNumber = order.order_number;
  if (!orderNumber) {
    const number = await client.query<{ value: string }>(
      "SELECT 'UFI-' || lpad(nextval('ticket_order_number_seq')::text, 6, '0') AS value"
    );
    orderNumber = number.rows[0].value;
  }

  await client.query(
    `UPDATE ticket_orders
        SET status = 'paid', order_number = COALESCE(order_number, $3),
            stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id),
            paid_at = COALESCE(paid_at, now()), updated_at = now()
      WHERE id = $1`,
    [orderId, paymentIntentId ?? null, orderNumber]
  );

  const items = await client.query<{
    id: string;
    quantity: number;
    ticket_type_name: string;
    ticket_type_id: string;
    unit_price_minor: number;
    event_id: string;
  }>(
    `SELECT i.id, i.quantity, i.ticket_type_name, i.ticket_type_id, i.unit_price_minor, o.event_id
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
  const eventId = items.rows[0]?.event_id;
  if (eventId) await advanceTicketTierProgression(client, eventId);
  await grantTicketMerchDiscount(client, {
    userId: order.user_id,
    ticketOrderId: orderId,
    source
  });
  await client.query(
    `INSERT INTO ticket_audit_log (id, order_id, action, details)
     VALUES ($1, $2, 'order_paid', $3::jsonb)`,
    [randomUUID(), orderId, JSON.stringify({ paymentIntentId: paymentIntentId ?? null, source })]
  );
  return {
    orderId,
    orderNumber,
    userId: order.user_id,
    email: order.email,
    displayName: order.display_name,
    totalMinor: order.total_minor,
    currency: order.currency,
    eventTitle: order.event_title,
    eventSlug: order.event_slug,
    metaConsentGranted: order.meta_consent_granted,
    metaPurchaseEventId: order.meta_purchase_event_id,
    metaContextEncrypted: order.meta_context_encrypted,
    contents: items.rows.map((item) => ({
      id: item.ticket_type_id,
      quantity: item.quantity,
      itemPriceMinor: item.unit_price_minor
    }))
  } satisfies FulfilledOrder;
}
