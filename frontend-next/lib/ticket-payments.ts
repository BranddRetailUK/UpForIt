import type Stripe from 'stripe';
import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { revokeUnusedMerchDiscountForTicketOrder } from './merch-discounts';

export function validatePaidSession(order: {id:string; total_minor:number; currency:string; stripe_checkout_session_id:string|null; stripe_payment_intent_id:string|null}, session: Stripe.Checkout.Session) {
  const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (session.mode !== 'payment' || session.payment_status !== 'paid' || !pi || session.amount_total !== order.total_minor || session.currency !== order.currency || session.metadata?.ticketOrderId !== order.id || session.client_reference_id !== order.id || (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== session.id) || (order.stripe_payment_intent_id && order.stripe_payment_intent_id !== pi)) throw new Error('Payment does not match stored ticket order');
  return pi;
}
export async function correlatePaidSession(client: PoolClient, session: Stripe.Checkout.Session, paidEventTime?:number) {
  const id = session.metadata?.ticketOrderId;
  if (!id) return null; // Other products sharing this Stripe account are not ticket orders.
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntent) throw new Error('Missing payment intent');
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ticket-payment:${paymentIntent}`]);
  const result = await client.query<{id:string;total_minor:number;currency:string;stripe_checkout_session_id:string|null;stripe_payment_intent_id:string|null}>('SELECT id,total_minor,currency,stripe_checkout_session_id,stripe_payment_intent_id FROM ticket_orders WHERE id=$1 FOR UPDATE',[id]);
  if (!result.rows[0]) throw new Error('Ticket order not found');
  const pi = validatePaidSession(result.rows[0], session);
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ticket-payment:${pi}`]);
  await client.query('UPDATE ticket_orders SET stripe_checkout_session_id=$2,stripe_payment_intent_id=$3,paid_at=COALESCE(paid_at,to_timestamp($4),now()) WHERE id=$1',[id,session.id,pi,paidEventTime ?? null]);
  await applyPaymentAdjustments(client, pi);
  return { id, pi };
}
export async function applyPaymentAdjustments(client: PoolClient, pi: string) {
  const order = (await client.query<{id:string;total_minor:number;currency:string;refunded_minor:number}>('SELECT id,total_minor,currency,refunded_minor FROM ticket_orders WHERE stripe_payment_intent_id=$1 FOR UPDATE',[pi])).rows[0];
  if (!order) return;
  const adjustment = (await client.query<{amount_minor:number;refunded_minor:number;currency:string}>('SELECT * FROM ticket_payment_adjustments WHERE payment_intent_id=$1',[pi])).rows[0];
  if (adjustment && (adjustment.currency !== order.currency || adjustment.amount_minor !== order.total_minor)) throw new Error('Refund does not match stored order');
  const disputed = Boolean((await client.query("SELECT id FROM ticket_payment_disputes WHERE payment_intent_id=$1 AND status <> 'won'",[pi])).rowCount);
  const refunded = Math.max(order.refunded_minor, adjustment?.refunded_minor ?? 0);
  if (!refunded && !disputed) return;
  const full = refunded >= order.total_minor;
  const changed = refunded > order.refunded_minor;
  await client.query(`UPDATE ticket_orders SET order_number=COALESCE(order_number,'UFI-' || lpad(nextval('ticket_order_number_seq')::text,6,'0')),refunded_minor=$2, admissions_hold=CASE WHEN $3 OR $4 OR $5 THEN true ELSE admissions_hold END,
    status=CASE WHEN $3 THEN 'refunded' ELSE 'refund_review' END,refunded_at=CASE WHEN $2>0 THEN COALESCE(refunded_at,now()) ELSE refunded_at END,updated_at=now() WHERE id=$1`,[order.id,refunded,full,disputed,changed]);
  if (full) await client.query("UPDATE tickets SET status='void' WHERE order_id=$1",[order.id]);
  await client.query("UPDATE email_jobs SET status='cancelled',last_error='Order is held for payment review' WHERE order_id=$1 AND status IN ('pending','failed')",[order.id]);
  if (full || disputed) await revokeUnusedMerchDiscountForTicketOrder(client,order.id);
  await client.query("INSERT INTO ticket_audit_log(id,order_id,action,details) VALUES($1,$2,'payment_adjustment',$3::jsonb)",[randomUUID(),order.id,JSON.stringify({refundedMinor:refunded,disputed})]);
}
export async function recordRefund(client: PoolClient, charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ticket-payment:${pi}`]);
  await client.query(`INSERT INTO ticket_payment_adjustments(payment_intent_id,charge_id,amount_minor,refunded_minor,currency) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(payment_intent_id) DO UPDATE SET refunded_minor=GREATEST(ticket_payment_adjustments.refunded_minor,EXCLUDED.refunded_minor),updated_at=now()`,[pi,charge.id,charge.amount,charge.amount_refunded,charge.currency]);
  await applyPaymentAdjustments(client,pi);
}
export async function recordDispute(client: PoolClient, dispute: Stripe.Dispute, created: number) {
  const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!pi) throw new Error('Dispute missing payment intent');
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ticket-payment:${pi}`]);
  await client.query(`INSERT INTO ticket_payment_disputes(id,payment_intent_id,status,event_created) VALUES($1,$2,$3,$4)
    ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,event_created=EXCLUDED.event_created WHERE ticket_payment_disputes.event_created <= EXCLUDED.event_created AND (ticket_payment_disputes.status NOT IN ('won','lost') OR EXCLUDED.status IN ('won','lost'))`,[dispute.id,pi,dispute.status,created]);
  await applyPaymentAdjustments(client,pi);
  // A won dispute is deliberately not auto-reactivated; admin must check admissions.
}
