import type Stripe from 'stripe';
import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {TicketRequestError} from './ticket-checkout-input';

export function finishedCheckout(order:{id:string;status:string}) {
 return {code:'checkout_finished',orderId:order.id,orderStatus:order.status,canStartNew:true,
  message:order.status==='expired'||order.status==='failed'?'This checkout has ended. You can start a new order.':'This checkout has finished. View your order before choosing to buy more tickets.'};
}
export function validateCheckoutIdentity(order:{id:string;total_minor:number;currency:string},session:Stripe.Checkout.Session){
 if(session.client_reference_id!==order.id||session.metadata?.ticketOrderId!==order.id||session.mode!=='payment'||session.amount_total!==order.total_minor||session.currency!==order.currency)throw new Error('Stripe checkout does not match order');
}
export async function findOrderCheckout(stripe:Stripe,order:{id:string;created_at:Date}) {
 let cursor:string|undefined;const found:Stripe.Checkout.Session[]=[];
 for(let page=0;page<100;page++){
  const result=await stripe.checkout.sessions.list({limit:100,created:{gte:Math.floor(new Date(order.created_at).getTime()/1000)-300},...(cursor?{starting_after:cursor}:{})});
  for(const session of result.data)if(session.client_reference_id===order.id||session.metadata?.ticketOrderId===order.id)found.push(session);
  if(!result.has_more){if(found.length>1)throw new Error('Multiple Stripe checkouts require review');return found[0]??null;}
  if(!result.data.length)throw new Error('Incomplete Stripe checkout listing');
  cursor=result.data[result.data.length-1].id;
 }
 throw new Error('Stripe checkout listing requires further review');
}
export async function recoverTicketCheckout(pool:Pool,stripe:Stripe,id:string,action:'resume'|'cancel'|'reconcile',userId?:string){
 const db=await pool.connect();let locked=false;
 try{
  locked=Boolean((await db.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[`ticket-session:${id}`])).rows[0].locked);
  if(!locked)throw new TicketRequestError('Checkout is being checked. Please try again shortly.',409);
  const order=(await db.query(`SELECT o.*, e.status AS event_status,e.sales_open,
    EXISTS(SELECT 1 FROM ticket_admin_live_tests a WHERE a.order_id=o.id AND a.actor_user_id=o.user_id AND a.expires_at>now()) AS admin_live_test,
    LEAST(e.ends_at,(SELECT min(tt.sales_end_at) FROM ticket_order_items i JOIN ticket_types tt ON tt.id=i.ticket_type_id WHERE i.order_id=o.id)) AS sales_deadline
    FROM ticket_orders o JOIN events e ON e.id=o.event_id WHERE o.id=$1 AND ($2::uuid IS NULL OR o.user_id=$2)`,[id,userId??null])).rows[0];
  if(!order)throw new TicketRequestError('Order not found.',404);
  if(order.status!=='pending')return finishedCheckout(order);
  await db.query('UPDATE ticket_orders SET checkout_checked_at=now() WHERE id=$1',[id]);
  const now=Date.now(),checkoutTimedOut=!!order.checkout_attempted_at&&now-new Date(order.checkout_attempted_at).getTime()>=30*60*1000,canSell=!checkoutTimedOut&&(order.admin_live_test&&['draft','published'].includes(order.event_status)||order.event_status==='published'&&order.sales_open)&&new Date(order.sales_deadline).getTime()>now;
  let session:Stripe.Checkout.Session|null=null;
  if(order.stripe_checkout_session_id)session=await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
  else {
   if(!order.checkout_attempted_at){
    if(action==='reconcile'&&canSell)return {code:'checkout_ready',orderId:id,message:'Checkout has not yet been submitted.'};
    if(action==='cancel'||!canSell)return await expireUncreated(db,order.id,'No Stripe submission was attempted');
    if(!order.checkout_payload)throw new Error('Missing checkout payload');
    // Set expiry immediately before the first submission, then persist the exact
    // request AND attempt marker before network IO. Neither changes on retry.
    // Stripe requires at least 30 minutes at receipt; allow five seconds for transit.
    order.checkout_payload={...order.checkout_payload,expires_at:Math.ceil(now/1000)+30*60+5};
    await db.query("UPDATE ticket_orders SET checkout_payload=$2::jsonb,checkout_attempted_at=now(),updated_at=now() WHERE id=$1 AND status='pending'",[id,JSON.stringify(order.checkout_payload)]);
    order.checkout_attempted_at=new Date(now);
   }else{
    // A list request can recover an accepted session even if its response was
    // lost or the original fixed expiry is now invalid for session creation.
    session=await findOrderCheckout(stripe,order);
   }
   if(!session){
    const expiry=Number(order.checkout_payload?.expires_at)*1000;
    const lastPossibleExpiry=Number.isFinite(expiry)?expiry:new Date(order.checkout_attempted_at).getTime()+48*3600000;
    if(lastPossibleExpiry<now-60000){
     // Full Stripe enumeration above found no matching payment or session, and
     // the immutable request can no longer create a payable session.
     return await expireUncreated(db,id,'Stripe enumeration found no session after the last possible expiry');
    }
    const withinKeyWindow=now-new Date(order.checkout_attempted_at).getTime()<23*3600000;
    if(action==='reconcile'||!withinKeyWindow||!Number.isFinite(expiry)||expiry<now+30*60000){
     await db.query("UPDATE ticket_orders SET checkout_state='review',checkout_last_error='Awaiting Stripe reconciliation; no new payment should be attempted',updated_at=now() WHERE id=$1 AND status='pending'",[id]);
     return {code:'checkout_review',orderId:id,message:'We are checking this checkout with Stripe. Do not pay again. Try checking your account shortly or contact support.'};
    }
    session=await stripe.checkout.sessions.create(order.checkout_payload,{idempotencyKey:`upforit-ticket-order-${id}`});
   }
  }
  validateCheckoutIdentity(order,session);
  if((action==='cancel'||!canSell)&&session.status==='open')session=await stripe.checkout.sessions.expire(session.id);
  validateCheckoutIdentity(order,session);
  // Webhook processing can finish while Stripe is responding. Never overwrite a
  // paid/refunded status, and never hand out its old payable URL afterwards.
  const updated=(await db.query(`UPDATE ticket_orders SET stripe_checkout_session_id=$2,stripe_checkout_url=$3,
    status=CASE WHEN status='pending' AND $4='expired' THEN 'expired' ELSE status END,
    checkout_state='ready',checkout_last_error=NULL,updated_at=now()
    WHERE id=$1 AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id=$2) RETURNING status`,[id,session.id,session.url,session.status])).rows[0];
  if(!updated)throw new Error('Checkout association conflict');
  if(updated.status!=='pending')return finishedCheckout({id,status:updated.status});
  if(session.status==='complete')return {code:'payment_confirming',orderId:id,message:'Payment is being confirmed. Do not pay again.',confirmationUrl:`/tickets/confirmation?session_id=${encodeURIComponent(session.id)}`};
  return {url:action==='resume'&&session.status==='open'?session.url:null,orderId:id,message:'Checkout status checked.'};
 }catch(error){
  if(locked)await db.query("UPDATE ticket_orders SET checkout_last_error=$2,updated_at=now() WHERE id=$1 AND status='pending'",[id,error instanceof Error?error.name:'UnknownError']).catch(()=>undefined);
  throw error;
 }finally{
  let discard=false;
  if(locked)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[`ticket-session:${id}`]).catch(()=>{discard=true;});
  db.release(discard);
 }
}
async function expireUncreated(db:PoolClient,id:string,reason:string){
 await db.query('BEGIN');
 try{
  const order=(await db.query("UPDATE ticket_orders SET status='expired',checkout_last_error=NULL,updated_at=now() WHERE id=$1 AND status='pending' RETURNING id,status",[id])).rows[0];
  if(order)await db.query("INSERT INTO ticket_audit_log(id,order_id,action,details) VALUES($1,$2,'checkout_reconciled',$3::jsonb)",[randomUUID(),id,JSON.stringify({reason})]);
  const current=order??(await db.query('SELECT id,status FROM ticket_orders WHERE id=$1',[id])).rows[0];
  await db.query('COMMIT');return finishedCheckout(current);
 }catch(error){await db.query('ROLLBACK');throw error;}
}
