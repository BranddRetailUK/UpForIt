import {randomUUID} from 'node:crypto';
import {httpError} from './security.mjs';

async function stripeRequest(path,method='GET') {
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key||(process.env.APP_ENV!=='production'&&!key.startsWith('sk_test_')))throw httpError(503,'Stripe reconciliation is not configured.');
 const response=await fetch('https://api.stripe.com/v1/checkout/sessions'+path,{method,headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw httpError(502,'Stripe could not confirm checkout status. Nothing was released.');
 return response.json();
}
export async function reconcileCheckout(pool,user,id,request=stripeRequest){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw httpError(400,'Invalid order.');
 const db=await pool.connect();let locked=false;
 try{
  locked=Boolean((await db.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[`ticket-session:${id}`])).rows[0].locked);
  if(!locked)throw httpError(409,'This checkout is already being checked. Try again shortly.');
  const order=(await db.query('SELECT * FROM ticket_orders WHERE id=$1',[id])).rows[0];
  if(!order)throw httpError(404,'Order not found.');
  if(order.status!=='pending')return {message:'Order is already '+order.status+'. Refresh the order list.'};
  let session=null,reason='';
  if(order.stripe_checkout_session_id)session=await request('/'+encodeURIComponent(order.stripe_checkout_session_id));
  else if(order.checkout_attempted_at){
   const matches=[];let cursor;let complete=false;
   for(let page=0;page<100;page++){
    const q=new URLSearchParams({limit:'100','created[gte]':String(Math.floor(new Date(order.created_at).getTime()/1000)-300),...(cursor?{starting_after:cursor}:{})});
    const result=await request('?'+q);
    for(const candidate of result.data)if(candidate.client_reference_id===id||candidate.metadata?.ticketOrderId===id)matches.push(candidate);
    if(!result.has_more){complete=true;break;}
    if(!result.data.length)throw httpError(409,'Stripe returned an incomplete listing. Keep this order on hold.');
    cursor=result.data.at(-1).id;
   }
   if(!complete||matches.length>1)throw httpError(409,'Stripe results require further review. No inventory was released.');
   session=matches[0]||null;
   const expiry=Number(order.checkout_payload?.expires_at)*1000;
   const lastPossibleExpiry=Number.isFinite(expiry)?expiry:new Date(order.checkout_attempted_at).getTime()+48*3600000;
   if(!session&&lastPossibleExpiry>=Date.now()-60000)throw httpError(409,'No matching session found yet. The submission may still be payable; check again after its expiry.');
   reason='Complete Stripe listing found no session after immutable expiry';
  }else reason='No Stripe submission was attempted';
  if(session&&(session.client_reference_id!==id||session.metadata?.ticketOrderId!==id||session.mode!=='payment'||session.amount_total!==order.total_minor||session.currency!==order.currency))throw httpError(409,'Stripe checkout does not match the stored order. Nothing was changed.');
  await db.query('BEGIN');
  const current=(await db.query('SELECT * FROM ticket_orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(current.status!=='pending'){await db.query('COMMIT');return {message:'Payment status changed during the check. Refresh this order.'};}
  if(session&&current.stripe_checkout_session_id&&current.stripe_checkout_session_id!==session.id)throw httpError(409,'Checkout association changed; retry reconciliation.');
  if(session)await db.query("UPDATE ticket_orders SET stripe_checkout_session_id=$2,stripe_checkout_url=$3,status=CASE WHEN $4='expired' THEN 'expired' ELSE status END,checkout_state='ready',checkout_last_error=NULL,checkout_checked_at=now(),updated_at=now() WHERE id=$1",[id,session.id,session.url,session.status]);
  else await db.query("UPDATE ticket_orders SET status='expired',checkout_last_error=NULL,checkout_checked_at=now(),updated_at=now() WHERE id=$1",[id]);
  await db.query("INSERT INTO ticket_audit_log(id,order_id,actor_user_id,action,details) VALUES($1,$2,$3,'admin_checkout_reconciled',$4::jsonb)",[randomUUID(),id,user.id,JSON.stringify({sessionId:session?.id,status:session?.status,reason})]);
  await db.query('INSERT INTO admin_audit_log(id,actor_id,action,subject_id,details) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),user.id,'Checkout reconciled with Stripe',id,JSON.stringify({sessionId:session?.id,status:session?.status,reason})]);
  await db.query('COMMIT');
  return {message:session?.status==='complete'?'Completed payment linked. Await the payment webhook; do not charge again.':session?.status==='open'?'Open Stripe checkout linked. The customer can resume or cancel it from their account.':'Unpaid checkout safely closed. The customer can start a new purchase.'};
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}
 finally{let discard=false;if(locked)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[`ticket-session:${id}`]).catch(()=>{discard=true;});db.release(discard);}
}
