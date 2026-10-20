import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { insertEmailJob } from './email-jobs';

// Caller holds the order lock. Lock its event too, so cancellation/closure and
// fulfilment cannot read inconsistent states. Keep this inside the payment tx.
export async function holdUnavailablePaidOrder(client: PoolClient, order: {
  id:string; user_id:string; email:string; display_name:string;
}) {
  const state = (await client.query<{reason:string|null}>(`
    SELECT CASE
      WHEN o.payment_review_reason IS NOT NULL THEN o.payment_review_reason
      WHEN e.status IN ('cancelled','completed') THEN 'event_unavailable'
      WHEN EXISTS(SELECT 1 FROM ticket_order_items i JOIN ticket_types tt ON tt.id=i.ticket_type_id
        WHERE i.order_id=o.id AND LEAST(tt.sales_end_at,e.ends_at)<=COALESCE(o.paid_at,now())) THEN 'sales_deadline_passed'
      WHEN COALESCE(h.status,e.status)<>'published' OR NOT COALESCE(h.sales_open,e.sales_open) THEN 'sales_closed_at_payment'
      ELSE NULL END AS reason
    FROM ticket_orders o JOIN events e ON e.id=o.event_id
    LEFT JOIN LATERAL (
      SELECT status,sales_open FROM ticket_event_sales_history
      WHERE event_id=e.id AND date_trunc('second',effective_at)<=COALESCE(o.paid_at,now())
      ORDER BY effective_at DESC,id DESC LIMIT 1
    ) h ON true
    WHERE o.id=$1 FOR SHARE OF e`,[order.id])).rows[0];
  if (!state) throw new Error('Ticket event not found');
  if (!state.reason) return false;
  await client.query(`UPDATE ticket_orders SET status='refund_review',admissions_hold=true,
    payment_review_reason=$2,order_number=COALESCE(order_number,'UFI-'||lpad(nextval('ticket_order_number_seq')::text,6,'0')),
    paid_at=COALESCE(paid_at,now()),updated_at=now() WHERE id=$1`,[order.id,state.reason]);
  await client.query("UPDATE email_jobs SET status='cancelled',last_error='Payment requires review' WHERE order_id=$1 AND job_type='ticket_confirmation' AND status IN ('pending','failed')",[order.id]);
  const existing = await client.query("SELECT id FROM email_jobs WHERE order_id=$1 AND job_type='ticket_payment_review'",[order.id]);
  if (!existing.rowCount) {
    await insertEmailJob(client,'ticket_payment_review',{to:order.email,displayName:order.display_name,orderId:order.id},{userId:order.user_id,orderId:order.id});
    await client.query("INSERT INTO ticket_audit_log(id,order_id,action,details) VALUES($1,$2,'payment_requires_review',$3::jsonb)",[randomUUID(),order.id,JSON.stringify({reason:state.reason})]);
  }
  return true;
}
