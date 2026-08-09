import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminForRequest } from "../../../../lib/admin-auth";
import { getPool } from "../../../../lib/db";
import { insertEmailJob } from "../../../../lib/email-jobs";
import { assertSameOrigin } from "../../../../lib/request";
import { assertTicketingEnabled } from "../../../../lib/stripe";
import { fulfilPaidOrder } from "../../../../lib/ticket-orders";
import { lockTicketTiersForCheckout } from "../../../../lib/ticket-tiers";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    assertTicketingEnabled();
    if (process.env.APP_ENV !== "testing") {
      return NextResponse.json({ error: "Simulated purchases are available only in Testing." }, { status: 403 });
    }
    const admin = await getAdminForRequest(request);
    if (!admin) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const ticketTypeId = typeof body.ticketTypeId === "string" ? body.ticketTypeId : "";
    const quantity = typeof body.quantity === "number" ? body.quantity : 0;
    const requestKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    if (!UUID_PATTERN.test(ticketTypeId) || !Number.isInteger(quantity) || quantity < 1 || !requestKey || requestKey.length > 80) {
      return NextResponse.json({ error: "Choose a valid ticket tier and quantity." }, { status: 400 });
    }

    const idempotencyKey = `admin-simulation:${requestKey}`;
    const requestHash = createHash("sha256").update(JSON.stringify({ ticketTypeId, quantity })).digest("hex");
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ id: string; order_number: string | null; request_hash: string }>(
        `SELECT id, order_number, request_hash
           FROM ticket_orders
          WHERE user_id = $1 AND idempotency_key = $2
          FOR UPDATE`,
        [admin.id, idempotencyKey]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== requestHash) throw new Error("This simulated purchase request has already been used.");
        if (!existing.rows[0].order_number) throw new Error("This simulated purchase is still being completed.");
        await client.query("COMMIT");
        return NextResponse.json({ ok: true, orderId: existing.rows[0].id, orderNumber: existing.rows[0].order_number });
      }

      const selection = { ticketTypeId, quantity };
      const locked = await lockTicketTiersForCheckout(client, [selection]);
      const tier = locked.tiers[0];
      const totalMinor = tier.price_minor * quantity;
      const orderId = randomUUID();
      await client.query(
        `INSERT INTO ticket_orders (
           id, user_id, event_id, status, currency, subtotal_minor, total_minor,
           idempotency_key, request_hash, reserved_until
         ) VALUES ($1, $2, $3, 'pending', 'gbp', $4, $4, $5, $6, now() + interval '5 minutes')`,
        [orderId, admin.id, tier.event_id, totalMinor, idempotencyKey, requestHash]
      );
      await client.query(
        `INSERT INTO ticket_order_items (
           id, order_id, ticket_type_id, ticket_type_name, unit_price_minor, quantity, line_total_minor
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), orderId, tier.id, tier.name, tier.price_minor, quantity, totalMinor]
      );

      const fulfilled = await fulfilPaidOrder(client, orderId, null, "admin_simulation");
      if (!fulfilled) throw new Error("The simulated ticket order could not be fulfilled.");
      await insertEmailJob(
        client,
        "ticket_confirmation",
        { to: fulfilled.email, displayName: fulfilled.displayName, orderId: fulfilled.orderId },
        { userId: fulfilled.userId, orderId: fulfilled.orderId }
      );
      await client.query(
        `INSERT INTO ticket_audit_log (id, actor_user_id, order_id, action, details)
         VALUES ($1, $2, $3, 'admin_simulated_purchase', $4::jsonb)`,
        [randomUUID(), admin.id, orderId, JSON.stringify({ ticketTypeId, quantity })]
      );
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, orderId, orderNumber: fulfilled.orderNumber });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The simulated purchase could not be completed.";
    console.error("Admin simulated purchase failed", message);
    const expected = message.includes("unavailable") || message.includes("Maximum") || message.includes("sold out") || message.includes("already been used");
    return NextResponse.json(
      { error: message === "TICKETING_DISABLED" ? "Ticket sales are not open." : message },
      { status: expected ? 409 : 500 }
    );
  }
}
