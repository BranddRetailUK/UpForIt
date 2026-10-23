import {grantTicketMerchDiscount} from "./merch-discounts";
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ticketPrice } from './ticket-pricing';
import { TicketRequestError } from './ticket-checkout-input';

export async function reviewAdmissions(db: PoolClient, orderId: string, actorId: string, keepIds: string[], expectedRefundedMinor: number) {
  const order = (await db.query(`SELECT o.*, e.slug, e.merch_discount_enabled FROM ticket_orders o JOIN events e ON e.id=o.event_id WHERE o.id=$1 FOR UPDATE OF o`, [orderId])).rows[0];
  if (!order || order.status !== 'refund_review' || !order.admissions_hold || !order.fulfilled_at) throw new TicketRequestError('Order is not awaiting admission review.',409);
  if (order.refunded_at && !order.refunded_minor) throw new TicketRequestError('Reconcile the legacy refund amount with Stripe before reviewing admissions.',409);
  if (order.refunded_minor !== expectedRefundedMinor) throw new TicketRequestError('Refund changed. Refresh before reviewing.',409);
  if ((await db.query("SELECT id FROM ticket_payment_disputes WHERE payment_intent_id=$1 AND status <> 'won'",[order.stripe_payment_intent_id])).rowCount) throw new TicketRequestError('Resolve the payment dispute before reactivating admissions.',409);
  const tickets = (await db.query('SELECT id,status FROM tickets WHERE order_id=$1 FOR UPDATE',[orderId])).rows;
  const selected = new Set(keepIds);
  if (selected.size !== keepIds.length || keepIds.some(id => !tickets.some(t => t.id===id && t.status!=='void'))) throw new TicketRequestError('Select existing non-void admissions only.',400);
  // Already used admissions always count against the money retained; they cannot be reset or reassigned.
  const consumed = tickets.filter(t => t.status === 'checked_in' || selected.has(t.id)).length;
  const items = (await db.query('SELECT unit_price_minor FROM ticket_order_items WHERE order_id=$1 AND unit_price_minor>0',[orderId])).rows;
  const price = Math.max(...items.map(i => i.unit_price_minor));
  if (!Number.isFinite(price) || ticketPrice(order.slug, price, consumed).totalMinor > order.total_minor-order.refunded_minor) throw new TicketRequestError('Retained payment does not cover the selected and already-used admissions, including the group offer.',409);
  await db.query("UPDATE tickets SET status='void' WHERE order_id=$1 AND status='valid' AND NOT(id=ANY($2::uuid[]))",[orderId,keepIds]);
  await db.query('UPDATE ticket_orders SET admissions_hold=false,updated_at=now() WHERE id=$1',[orderId]);
  if(order.user_id && order.merch_discount_enabled && consumed>0 && order.stripe_payment_intent_id) await grantTicketMerchDiscount(db,{userId:order.user_id,ticketOrderId:orderId,source:'stripe'});
  await db.query("INSERT INTO ticket_audit_log(id,order_id,actor_user_id,action,details) VALUES($1,$2,$3,'admissions_reviewed',$4::jsonb)",[randomUUID(),orderId,actorId,JSON.stringify({keepIds,refundedMinor:order.refunded_minor,consumed})]);
}
