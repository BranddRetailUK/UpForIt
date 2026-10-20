import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { insertEmailJob } from './email-jobs';
import { TicketRequestError } from './ticket-checkout-input';
export async function resendTickets(db:PoolClient,orderId:string,actorId:string,admin:boolean){
  const order=(await db.query(`SELECT o.user_id,u.email,u.display_name FROM ticket_orders o JOIN users u ON u.id=o.user_id WHERE o.id=$1 AND (o.user_id=$2 OR $3) AND o.status IN ('paid','refund_review') AND o.admissions_hold=false AND EXISTS(SELECT 1 FROM tickets t WHERE t.order_id=o.id AND t.status<>'void') FOR UPDATE OF o`,[orderId,actorId,admin])).rows[0];
  if(!order)throw new TicketRequestError('Available ticket order not found.',404);
  const recent=await db.query(`SELECT id FROM email_jobs WHERE order_id=$1 AND job_type='ticket_confirmation' AND (created_at>now()-interval '2 minutes' OR sent_at>now()-interval '2 minutes' OR status IN ('pending','processing','unknown') OR (status='failed' AND attempts<5))`,[orderId]);
  if(recent.rowCount)throw new TicketRequestError('A confirmation is already queued, awaiting delivery review, or was recently requested. Check its delivery status before resending.',429);
  await insertEmailJob(db,'ticket_confirmation',{to:order.email,displayName:order.display_name,orderId},{userId:order.user_id,orderId});
  await db.query("INSERT INTO ticket_audit_log(id,order_id,actor_user_id,action) VALUES($1,$2,$3,'confirmation_resend')",[randomUUID(),orderId,actorId]);
}
