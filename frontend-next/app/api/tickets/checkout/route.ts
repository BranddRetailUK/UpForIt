import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../lib/auth";
import { getPool } from "../../../../lib/db";
import { insertMetaConversionJob } from "../../../../lib/meta-jobs";
import { getMetaRequestContext, metaEventId, metaSiteUrl } from "../../../../lib/meta";
import { assertSameOrigin } from "../../../../lib/request";
import { encryptJson } from "../../../../lib/security";
import { assertTicketingEnabled, getStripe } from "../../../../lib/stripe";
import { lockTicketTiersForCheckout, type TicketCheckoutTier } from "../../../../lib/ticket-tiers";

type CheckoutItem = { ticketTypeId: string; quantity: number };

export async function POST(request: NextRequest) {
  let orderId: string | null = null;
  try {
    assertSameOrigin(request);
    assertTicketingEnabled();
    const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return NextResponse.json({ error: "Sign in to buy tickets." }, { status: 401 });
    if (!user.emailVerified) return NextResponse.json({ error: "Verify your email before buying tickets." }, { status: 403 });

    const body = (await request.json()) as { items?: CheckoutItem[]; idempotencyKey?: string; meta?: unknown };
    const metaContext = getMetaRequestContext(request, body.meta);
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
    let checkoutRows: TicketCheckoutTier[] = [];
    let totalMinor = 0;
    let purchaseEventId = "";
    try {
      await client.query("BEGIN");
      const locked = await lockTicketTiersForCheckout(client, normalizedItems);
      checkoutRows = locked.tiers;
      totalMinor = normalizedItems.reduce(
        (sum, item, index) => sum + checkoutRows[index].price_minor * item.quantity,
        0
      );

      orderId = randomUUID();
      purchaseEventId = metaEventId("ticket_purchase", orderId);
      await client.query(
        `INSERT INTO ticket_orders (
           id, user_id, event_id, status, currency, subtotal_minor, total_minor,
           idempotency_key, request_hash, reserved_until, meta_consent_granted,
           meta_checkout_event_id, meta_purchase_event_id, meta_context_encrypted
         ) VALUES (
           $1, $2, $3, 'pending', 'gbp', $4, $4, $5, $6, now() + interval '30 minutes',
           $7, $8, $9, $10
         )`,
        [
          orderId,
          user.id,
          checkoutRows[0].event_id,
          totalMinor,
          idempotencyKey,
          requestHash,
          metaContext.consent,
          metaContext.consent ? metaContext.eventId ?? null : null,
          metaContext.consent ? purchaseEventId : null,
          metaContext.consent ? encryptJson({
            fbp: metaContext.fbp,
            fbc: metaContext.fbc,
            clientIp: metaContext.clientIp,
            clientUserAgent: metaContext.clientUserAgent
          }) : null
        ]
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
        metadata: { ticketOrderId: orderId },
        payment_intent_data: { metadata: { ticketOrderId: orderId } },
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
    if (metaContext.consent && metaContext.eventId) {
      try {
        await insertMetaConversionJob(
          getPool(),
          {
            eventName: "InitiateCheckout",
            eventId: metaContext.eventId,
            eventSourceUrl: metaSiteUrl(`/events/${checkoutRows[0].event_slug}`),
            valueMinor: totalMinor,
            currency: checkoutRows[0].currency,
            contentName: checkoutRows[0].event_title,
            contentCategory: "event tickets",
            contents: normalizedItems.map((item, index) => ({
              id: checkoutRows[index].id,
              quantity: item.quantity,
              itemPriceMinor: checkoutRows[index].price_minor
            })),
            userData: {
              email: user.email,
              externalId: user.id,
              fbp: metaContext.fbp,
              fbc: metaContext.fbc,
              clientIp: metaContext.clientIp,
              clientUserAgent: metaContext.clientUserAgent
            }
          },
          { orderId }
        );
      } catch (metaError) {
        console.error("Meta checkout job could not be queued", metaError instanceof Error ? metaError.name : "UnknownError");
      }
    }
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
