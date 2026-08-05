import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getPool } from "../../../../lib/db";
import { insertEmailJob } from "../../../../lib/email-jobs";
import { getStripe } from "../../../../lib/stripe";
import { fulfilPaidOrder } from "../../../../lib/ticket-orders";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_TICKETS_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return new NextResponse("Webhook is not configured", { status: 503 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error instanceof Error ? error.message : error);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const expectLive = process.env.APP_ENV === "production";
  if (event.livemode !== expectLive) return new NextResponse("Wrong Stripe mode", { status: 400 });

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const receipt = await client.query(
      `INSERT INTO stripe_event_receipts (stripe_event_id, event_type, livemode, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING stripe_event_id`,
      [event.id, event.type, event.livemode, JSON.stringify(event)]
    );
    if (!receipt.rowCount) {
      const previous = await client.query<{ processed_at: Date | null }>(
        "SELECT processed_at FROM stripe_event_receipts WHERE stripe_event_id = $1 FOR UPDATE",
        [event.id]
      );
      if (previous.rows[0]?.processed_at) {
        await client.query("COMMIT");
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded") {
        const orderId = session.metadata?.ticketOrderId || session.client_reference_id;
        if (!orderId) throw new Error("Checkout session is missing ticketOrderId");
        const fulfilled = await fulfilPaidOrder(
          client,
          orderId,
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
        );
        if (fulfilled) {
          await insertEmailJob(
            client,
            "ticket_confirmation",
            { to: fulfilled.email, displayName: fulfilled.displayName, orderId: fulfilled.orderId },
            { userId: fulfilled.userId, orderId: fulfilled.orderId }
          );
        }
      }
    } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.ticketOrderId || session.client_reference_id;
      if (orderId) {
        await client.query(
          `UPDATE ticket_orders SET status = $2, updated_at = now()
            WHERE id = $1 AND status = 'pending'`,
          [orderId, event.type === "checkout.session.expired" ? "expired" : "failed"]
        );
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) {
        const status = charge.amount_refunded >= charge.amount ? "refunded" : "refund_review";
        const order = await client.query<{ id: string }>(
          `UPDATE ticket_orders SET status = $2,
             refunded_at = CASE WHEN $2 = 'refunded' THEN now() ELSE refunded_at END,
             stripe_charge_id = $3, updated_at = now()
           WHERE stripe_payment_intent_id = $1 RETURNING id`,
          [paymentIntentId, status, charge.id]
        );
        if (order.rows[0]) {
          if (status === "refunded") {
            await client.query("UPDATE tickets SET status = 'void' WHERE order_id = $1", [order.rows[0].id]);
          }
          await client.query(
            `INSERT INTO ticket_audit_log (id, order_id, action, details)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [randomUUID(), order.rows[0].id, status, JSON.stringify({ chargeId: charge.id, amountRefunded: charge.amount_refunded })]
          );
        }
      }
    }

    await client.query(
      "UPDATE stripe_event_receipts SET processed_at = now(), error_message = NULL WHERE stripe_event_id = $1",
      [event.id]
    );
    await client.query("COMMIT");
    return NextResponse.json({ received: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("Stripe ticket webhook failed", event.id, message);
    await getPool().query(
      `INSERT INTO stripe_event_receipts (stripe_event_id, event_type, livemode, payload, error_message)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (stripe_event_id) DO UPDATE SET error_message = EXCLUDED.error_message`,
      [event.id, event.type, event.livemode, JSON.stringify(event), message.slice(0, 1000)]
    ).catch(() => undefined);
    return new NextResponse("Webhook processing failed", { status: 500 });
  } finally {
    client.release();
  }
}
