import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { assertSameOrigin } from "../../../../lib/request";
import { assertTicketingEnabled, getStripe } from "../../../../lib/stripe";

type CheckoutItem = { ticketTypeId: string; quantity: number };

export async function POST(request: NextRequest) {
  let orderId: string | null = null;
  try {
    assertSameOrigin(request);
    assertTicketingEnabled();
    const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return NextResponse.json({ error: "Sign in to buy tickets." }, { status: 401 });
    if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before buying tickets." }, { status: 403 });

    const body = (await request.json()) as { items?: CheckoutItem[]; idempotencyKey?: string };
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const items = Array.isArray(body.items)
      ? body.items.filter((item) => typeof item.ticketTypeId === "string" && Number.isInteger(item.quantity) && item.quantity > 0)
      : [];
    if (!idempotencyKey || idempotencyKey.length > 100 || items.length < 1 || items.length > 10) {
      return NextResponse.json({ error: "Choose at least one ticket." }, { status: 400 });
    }

    const normalizedItems = [...items].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId));
    const requestHash = createHash("sha256").update(JSON.stringify(normalizedItems)).digest("hex");
    const existing = await getPool().query<{ stripe_checkout_url: string | null; request_hash: string; status: string }>(
      "SELECT stripe_checkout_url, request_hash, status FROM ticket_orders WHERE user_id = $1 AND idempotency_key = $2",
      [user.id, idempotencyKey]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== requestHash) {
        return NextResponse.json({ error: "This checkout request has already been used." }, { status: 409 });
      }
      if (existing.rows[0].stripe_checkout_url && existing.rows[0].status === "pending") {
        return NextResponse.json({ url: existing.rows[0].stripe_checkout_url });
      }
    }

    const client = await getPool().connect();
    let checkoutRows: Array<{
      id: string; name: string; price_minor: number; currency: string; max_per_order: number;
      capacity: number | null; event_id: string; event_slug: string; event_title: string;
    }> = [];
    let totalMinor = 0;
    let orderNumber = "";
    try {
      await client.query("BEGIN");
      const ids = normalizedItems.map((item) => item.ticketTypeId);
      const tiers = await client.query<{
        id: string; name: string; price_minor: number; currency: string; max_per_order: number;
        capacity: number | null; event_id: string; event_slug: string; event_title: string;
      }>(
        `SELECT tt.id, tt.name, tt.price_minor, tt.currency, tt.max_per_order, tt.capacity,
                e.id AS event_id, e.slug AS event_slug, e.title AS event_title
           FROM ticket_types tt JOIN events e ON e.id = tt.event_id
          WHERE tt.id = ANY($1::uuid[]) AND tt.is_active = true AND e.status = 'published'
            AND (tt.sales_start_at IS NULL OR tt.sales_start_at <= now())
            AND (tt.sales_end_at IS NULL OR tt.sales_end_at > now())
          FOR UPDATE OF tt`,
        [ids]
      );
      if (tiers.rowCount !== normalizedItems.length || new Set(tiers.rows.map((row) => row.event_id)).size !== 1) {
        throw new Error("One or more ticket tiers are unavailable.");
      }
      checkoutRows = normalizedItems.map((item) => {
        const tier = tiers.rows.find((row) => row.id === item.ticketTypeId);
        if (!tier) throw new Error("A ticket tier is unavailable.");
        if (item.quantity > tier.max_per_order) throw new Error(`Maximum ${tier.max_per_order} ${tier.name} tickets per order.`);
        return tier;
      });

      for (let index = 0; index < normalizedItems.length; index += 1) {
        const item = normalizedItems[index];
        const tier = checkoutRows[index];
        if (tier.capacity !== null) {
          const reserved = await client.query<{ quantity: string }>(
            `SELECT COALESCE(sum(i.quantity), 0)::text AS quantity
               FROM ticket_order_items i JOIN ticket_orders o ON o.id = i.order_id
              WHERE i.ticket_type_id = $1
                AND (o.status = 'paid' OR (o.status = 'pending' AND o.reserved_until > now()))`,
            [tier.id]
          );
          if (Number(reserved.rows[0].quantity) + item.quantity > tier.capacity) throw new Error(`${tier.name} has sold out.`);
        }
        totalMinor += tier.price_minor * item.quantity;
      }

      orderId = randomUUID();
      const numberResult = await client.query<{ value: string }>(
        "SELECT 'UFI-' || lpad(nextval('ticket_order_number_seq')::text, 6, '0') AS value"
      );
      orderNumber = numberResult.rows[0].value;
      await client.query(
        `INSERT INTO ticket_orders (
           id, order_number, user_id, event_id, status, currency, subtotal_minor, total_minor,
           idempotency_key, request_hash, reserved_until
         ) VALUES ($1, $2, $3, $4, 'pending', 'gbp', $5, $5, $6, $7, now() + interval '30 minutes')`,
        [orderId, orderNumber, user.id, checkoutRows[0].event_id, totalMinor, idempotencyKey, requestHash]
      );
      for (let index = 0; index < normalizedItems.length; index += 1) {
        const item = normalizedItems[index];
        const tier = checkoutRows[index];
        await client.query(
          `INSERT INTO ticket_order_items (
             id, order_id, ticket_type_id, ticket_type_name, unit_price_minor, quantity, line_total_minor
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [randomUUID(), orderId, tier.id, tier.name, tier.price_minor, item.quantity, tier.price_minor * item.quantity]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl || !orderId) throw new Error("Ticketing site URL is not configured.");
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user.email,
        client_reference_id: orderId,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: { ticketOrderId: orderId, orderNumber },
        payment_intent_data: { metadata: { ticketOrderId: orderId, orderNumber } },
        line_items: normalizedItems.map((item, index) => ({
          quantity: item.quantity,
          price_data: {
            currency: checkoutRows[index].currency,
            unit_amount: checkoutRows[index].price_minor,
            product_data: { name: `${checkoutRows[index].event_title} — ${checkoutRows[index].name}` }
          }
        })),
        success_url: `${siteUrl}/tickets/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/events/${checkoutRows[0].event_slug}?checkout=cancelled`
      },
      { idempotencyKey: `upforit-ticket-order-${orderId}` }
    );
    await getPool().query(
      "UPDATE ticket_orders SET stripe_checkout_session_id = $2, stripe_checkout_url = $3, updated_at = now() WHERE id = $1",
      [orderId, session.id, session.url]
    );
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (orderId) {
      await getPool().query("UPDATE ticket_orders SET status = 'failed', updated_at = now() WHERE id = $1 AND status = 'pending'", [orderId]).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "Checkout could not be started.";
    console.error("Ticket checkout failed", message);
    const status = message.includes("unavailable") || message.includes("Maximum") || message.includes("sold out") ? 409 : 500;
    return NextResponse.json({ error: message === "TICKETING_DISABLED" ? "Ticket sales are not open." : message }, { status });
  }
}
