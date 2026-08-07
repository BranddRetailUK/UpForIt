import type { PoolClient } from "pg";
import { chooseActiveTicketTier } from "./ticket-tier-policy";

export type TicketSelection = { ticketTypeId: string; quantity: number };

export type TicketCheckoutTier = {
  id: string;
  name: string;
  price_minor: number;
  currency: string;
  max_per_order: number;
  capacity: number | null;
  event_id: string;
  event_slug: string;
  event_title: string;
};

export async function advanceTicketTierProgression(client: PoolClient, eventId: string) {
  const locked = await client.query<{
    id: string;
    capacity: number | null;
    is_active: boolean;
  }>(
    `SELECT id, capacity, is_active
       FROM ticket_types
      WHERE event_id = $1
      ORDER BY sort_order, price_minor
      FOR UPDATE`,
    [eventId]
  );
  if (!locked.rowCount) return null;

  const paid = await client.query<{ ticket_type_id: string; paid_quantity: string }>(
    `SELECT i.ticket_type_id, COALESCE(sum(i.quantity), 0)::text AS paid_quantity
       FROM ticket_order_items i
       JOIN ticket_orders o ON o.id = i.order_id
      WHERE o.event_id = $1 AND o.status = 'paid'
      GROUP BY i.ticket_type_id`,
    [eventId]
  );
  const paidByTier = new Map(paid.rows.map((row) => [row.ticket_type_id, Number(row.paid_quantity)]));
  const activeId = chooseActiveTicketTier(
    locked.rows.map((tier) => ({
      id: tier.id,
      capacity: tier.capacity,
      paidQuantity: paidByTier.get(tier.id) ?? 0,
      active: tier.is_active
    }))
  );

  await client.query(
    `UPDATE ticket_types
        SET is_active = CASE WHEN $2::uuid IS NOT NULL AND id = $2::uuid THEN true ELSE false END,
            updated_at = CASE
              WHEN is_active IS DISTINCT FROM CASE WHEN $2::uuid IS NOT NULL AND id = $2::uuid THEN true ELSE false END
              THEN now() ELSE updated_at END
      WHERE event_id = $1`,
    [eventId, activeId]
  );
  return activeId;
}

export async function lockTicketTiersForCheckout(client: PoolClient, selections: TicketSelection[]) {
  const ids = selections.map((item) => item.ticketTypeId);
  const eventIds = await client.query<{ event_id: string }>(
    "SELECT DISTINCT event_id FROM ticket_types WHERE id = ANY($1::uuid[])",
    [ids]
  );
  if (eventIds.rowCount !== 1) throw new Error("One or more ticket tiers are unavailable.");
  const eventId = eventIds.rows[0].event_id;
  await advanceTicketTierProgression(client, eventId);

  const tiers = await client.query<TicketCheckoutTier>(
    `SELECT tt.id, tt.name, tt.price_minor, tt.currency, tt.max_per_order, tt.capacity,
            e.id AS event_id, e.slug AS event_slug, e.title AS event_title
       FROM ticket_types tt
       JOIN events e ON e.id = tt.event_id
      WHERE tt.id = ANY($1::uuid[]) AND tt.is_active = true AND e.status = 'published'
        AND (tt.sales_start_at IS NULL OR tt.sales_start_at <= now())
        AND (tt.sales_end_at IS NULL OR tt.sales_end_at > now())
      FOR UPDATE OF tt`,
    [ids]
  );
  if (tiers.rowCount !== selections.length) throw new Error("One or more ticket tiers are unavailable.");

  const orderedTiers = selections.map((selection) => {
    const tier = tiers.rows.find((candidate) => candidate.id === selection.ticketTypeId);
    if (!tier) throw new Error("A ticket tier is unavailable.");
    if (selection.quantity > tier.max_per_order) {
      throw new Error(`Maximum ${tier.max_per_order} ${tier.name} tickets per order.`);
    }
    return tier;
  });

  for (let index = 0; index < selections.length; index += 1) {
    const selection = selections[index];
    const tier = orderedTiers[index];
    if (tier.capacity === null) continue;
    // An open Stripe Checkout does not hold inventory. Paid orders alone move
    // availability and tier progression; already-created sessions keep their price.
    const allocated = await client.query<{ quantity: string }>(
      `SELECT COALESCE(sum(i.quantity), 0)::text AS quantity
         FROM ticket_order_items i
         JOIN ticket_orders o ON o.id = i.order_id
        WHERE i.ticket_type_id = $1
          AND o.status = 'paid'`,
      [tier.id]
    );
    if (Number(allocated.rows[0].quantity) + selection.quantity > tier.capacity) {
      throw new Error(`${tier.name} has sold out.`);
    }
  }

  return { eventId, tiers: orderedTiers };
}
