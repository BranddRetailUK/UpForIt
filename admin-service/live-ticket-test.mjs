import {randomUUID,createHash} from 'node:crypto';
import {httpError} from './security.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function liveTestEnabled(){return process.env.ADMIN_LIVE_TICKET_TESTS_ENABLED==='true'&&process.env.APP_ENV==='production'&&/^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY||'');}
export function priceTest(tier,quantity){
 if(!Number.isInteger(quantity)||quantity<1||quantity>Math.min(10,tier.max_per_order))throw httpError(400,'Choose 1–10 admissions within the ticket limit.');
 if(tier.currency!=='gbp'||tier.price_minor<30||(tier.slug==='nye-2026'&&(tier.price_minor!==1000||tier.capacity!==null)))throw httpError(409,'Ticket pricing is not ready for a live test.');
 const free=tier.slug==='nye-2026'?Math.floor(quantity/4):0;
 return [{name:tier.name,quantity:quantity-free,unitPriceMinor:tier.price_minor},{name:tier.name+' — group offer (free)',quantity:free,unitPriceMinor:0}].filter(x=>x.quantity);
}
function encodeForm(value,prefix='',form=new URLSearchParams()){
 for(const [key,v]of Object.entries(value)){if(v===undefined||v===null)continue;const name=prefix?`${prefix}[${key}]`:key;if(typeof v==='object')encodeForm(v,name,form);else form.append(name,String(v));}return form;
}
export async function liveStripeRequest(path,method='GET',payload,key){
 if(!liveTestEnabled())throw httpError(503,'Live ticket tests are disabled.');
 const response=await fetch('https://api.stripe.com/v1/checkout/sessions'+path,{method,headers:{Authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,...(payload?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},body:payload?encodeForm(payload):undefined,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw httpError(502,'Stripe has not confirmed this request. Refresh this test and retry the same checkout; do not create another payment.');
 return response.json();
}
const tierSql=`SELECT tt.*,e.slug,e.title,e.status AS event_status,e.sales_open,e.starts_at,e.ends_at,LEAST(tt.sales_end_at,e.ends_at) AS deadline FROM ticket_types tt JOIN events e ON e.id=tt.event_id`;
export async function liveTestData(db,user){
 const tiers=(await db.query(tierSql+" WHERE tt.archived_at IS NULL AND tt.is_active=true AND e.status IN ('draft','published') AND LEAST(tt.sales_end_at,e.ends_at)>now()+interval '36 minutes' ORDER BY e.starts_at,tt.sort_order")).rows;
 const orders=(await db.query(`SELECT o.id,o.order_number,o.status,o.total_minor,o.currency,o.created_at,o.fulfilled_at,o.admissions_hold,o.refunded_minor,o.stripe_payment_intent_id,o.stripe_checkout_session_id,a.expires_at,e.title AS event_title,
  (SELECT json_agg(json_build_object('ticket_number',t.ticket_number,'status',t.status,'checked_in_at',t.checked_in_at) ORDER BY t.ticket_number) FROM tickets t WHERE t.order_id=o.id) AS tickets,
  (SELECT json_agg(json_build_object('type',j.job_type,'status',j.status,'attempts',j.attempts,'sent_at',j.sent_at) ORDER BY j.created_at) FROM email_jobs j WHERE j.order_id=o.id) AS emails,
  (SELECT json_agg(json_build_object('status',m.status)) FROM merch_discount_entitlements m WHERE m.source_ticket_order_id=o.id) AS merch_discounts,
  (SELECT count(*)::int FROM stripe_event_receipts r WHERE r.event_type IN ('checkout.session.completed','checkout.session.async_payment_succeeded') AND r.payload#>>'{data,object,metadata,ticketOrderId}'=o.id::text AND r.processed_at IS NOT NULL) AS processed_webhooks
  FROM ticket_admin_live_tests a JOIN ticket_orders o ON o.id=a.order_id JOIN events e ON e.id=o.event_id WHERE a.actor_user_id=$1 AND o.user_id=$1 ORDER BY a.authorised_at DESC LIMIT 30`,[user.id])).rows;
 return {enabled:liveTestEnabled(),email:user.email,tiers:tiers.map(t=>({id:t.id,name:t.name,event_title:t.title,event_slug:t.slug,price_minor:t.price_minor,max_per_order:Math.min(t.max_per_order,10)})),orders};
}
export async function createLiveTest(pool,user,body,origin,request=liveStripeRequest){
 if(!liveTestEnabled())throw httpError(503,'Live ticket tests are disabled.');
 if(!uuid.test(body.ticketTypeId||'')||!uuid.test(body.requestId||'')||body.confirm!=='LIVE PAYMENT')throw httpError(400,'Select a ticket and confirm LIVE PAYMENT.');
 const fingerprint=createHash('sha256').update(JSON.stringify([body.ticketTypeId,body.quantity])).digest('hex');
 const db=await pool.connect();let id;
 try{
  await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ticket-checkout:${user.id}`]);
  const actor=(await db.query("SELECT id,email FROM users WHERE id=$1 AND role='admin' AND email_verified_at IS NOT NULL AND disabled_at IS NULL FOR SHARE",[user.id])).rows[0];
  if(!actor)throw httpError(403,'A verified administrator is required.');
  let order=(await db.query('SELECT o.*,a.order_id AS test_id FROM ticket_orders o LEFT JOIN ticket_admin_live_tests a ON a.order_id=o.id WHERE o.user_id=$1 AND o.idempotency_key=$2 FOR UPDATE OF o',[user.id,'admin-live:'+body.requestId])).rows[0];
  if(order){if(!order.test_id||order.request_hash!==fingerprint)throw httpError(409,'This reference belongs to a different test.');id=order.id;}
  else{
   if((await db.query("SELECT id FROM ticket_orders WHERE user_id=$1 AND status='pending'",[user.id])).rowCount)throw httpError(409,'An open checkout already exists. Resume or cancel it before starting another.');
   const tier=(await db.query(tierSql+" WHERE tt.id=$1 AND tt.archived_at IS NULL AND tt.is_active=true AND e.status IN ('draft','published') AND LEAST(tt.sales_end_at,e.ends_at)>now()+interval '36 minutes' FOR UPDATE OF tt FOR SHARE OF e",[body.ticketTypeId])).rows[0];
   if(!tier)throw httpError(409,'This event or ticket is unavailable.');
   const lines=priceTest(tier,body.quantity),total=lines.reduce((sum,l)=>sum+l.quantity*l.unitPriceMinor,0);
   if(body.expectedTotalMinor!==total)throw httpError(409,'The ticket price changed. Refresh and review the price.');
   const allocated=Number((await db.query("SELECT COALESCE(sum(i.quantity),0) n FROM ticket_order_items i JOIN ticket_orders o ON o.id=i.order_id WHERE i.ticket_type_id=$1 AND o.status IN ('pending','paid','refund_review')",[tier.id])).rows[0].n);
   if(tier.capacity!==null&&allocated+body.quantity>tier.capacity)throw httpError(409,'Not enough ticket capacity.');
   id=randomUUID();
   const site=process.env.STOREFRONT_URL||'https://www.upforitevents.co.uk';
   const payload={mode:'payment',payment_method_types:['card'],customer_email:actor.email,client_reference_id:id,metadata:{ticketOrderId:id},payment_intent_data:{metadata:{ticketOrderId:id}},expires_at:Math.floor(Date.now()/1000)+35*60,
    line_items:lines.map(l=>({quantity:l.quantity,price_data:{currency:'gbp',unit_amount:l.unitPriceMinor,product_data:{name:`${tier.title} — ${l.name}`}}})),success_url:`${site}/tickets/confirmation?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${origin}/ticket-test`};
   await db.query(`INSERT INTO ticket_orders(id,user_id,event_id,subtotal_minor,total_minor,idempotency_key,request_hash,reserved_until,checkout_payload,checkout_attempted_at) VALUES($1,$2,$3,$4,$4,$5,$6,now()+interval '35 minutes',$7::jsonb,NULL)`,[id,user.id,tier.event_id,total,'admin-live:'+body.requestId,fingerprint,JSON.stringify(payload)]);
   await db.query("INSERT INTO ticket_admin_live_tests(order_id,actor_user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[id,user.id]);
   for(const l of lines)await db.query('INSERT INTO ticket_order_items(id,order_id,ticket_type_id,ticket_type_name,unit_price_minor,quantity,line_total_minor) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,tier.id,l.name,l.unitPriceMinor,l.quantity,l.unitPriceMinor*l.quantity]);
   await db.query("INSERT INTO ticket_audit_log(id,order_id,actor_user_id,action,details) VALUES($1,$2,$3,'admin_live_test_authorised',$4::jsonb)",[randomUUID(),id,user.id,JSON.stringify({quantity:body.quantity,totalMinor:total})]);
   await db.query("INSERT INTO admin_audit_log(id,actor_id,action,subject_id,details) VALUES($1,$2,'Live paid ticket test authorised',$3,$4::jsonb)",[randomUUID(),user.id,id,JSON.stringify({totalMinor:total})]);
  }
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 return operateLiveTest(pool,user,id,'resume',request);
}
function validate(order,session){
 if(session.livemode!==true||session.mode!=='payment'||session.client_reference_id!==order.id||session.metadata?.ticketOrderId!==order.id||session.amount_total!==order.total_minor||session.currency!==order.currency)throw httpError(409,'Stripe session does not match this live test. No payment state was changed.');
 if(session.url&&new URL(session.url).origin!=='https://checkout.stripe.com')throw httpError(409,'Unexpected checkout address.');
}
export async function operateLiveTest(pool,user,id,action,request=liveStripeRequest){
 if(!liveTestEnabled())throw httpError(503,'Live ticket tests are disabled.');
 if(!uuid.test(id||'')||!['resume','cancel'].includes(action))throw httpError(400,'Invalid test action.');
 const db=await pool.connect();let locked=false;
 try{
  locked=Boolean((await db.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[`ticket-session:${id}`])).rows[0].locked);
  if(!locked)throw httpError(409,'Checkout is already being checked. Please retry shortly.');
  const order=(await db.query(`SELECT o.*,a.expires_at,e.status AS event_status,LEAST(e.ends_at,(SELECT min(tt.sales_end_at) FROM ticket_order_items i JOIN ticket_types tt ON tt.id=i.ticket_type_id WHERE i.order_id=o.id)) AS deadline FROM ticket_orders o JOIN ticket_admin_live_tests a ON a.order_id=o.id JOIN events e ON e.id=o.event_id WHERE o.id=$1 AND o.user_id=$2 AND a.actor_user_id=$2`,[id,user.id])).rows[0];
  if(!order)throw httpError(404,'Test order not found.');
  if(order.status!=='pending')return {orderId:id,message:'Order is '+order.status+'. Check its progress below.'};
  let session;
  const canSell=['draft','published'].includes(order.event_status)&&new Date(order.expires_at)>new Date()&&new Date(order.deadline)>new Date();
  if(order.stripe_checkout_session_id)session=await request('/'+encodeURIComponent(order.stripe_checkout_session_id));
  else if(!order.checkout_attempted_at&&(action==='cancel'||!canSell)){
   await db.query("UPDATE ticket_orders SET status='expired',updated_at=now() WHERE id=$1 AND status='pending'",[id]);return {orderId:id,message:'Unsubmitted checkout cancelled.'};
  }else{
   // Retry only the immutable first request, within its short valid creation window.
   // Later recovery belongs to the existing worker/admin Stripe reconciliation.
   if(!canSell||Number(order.checkout_payload?.expires_at)*1000<Date.now()+30*60000)throw httpError(409,'This submission needs Stripe reconciliation. Use Check Stripe checkout in Tickets & orders; do not pay again.');
   await db.query('UPDATE ticket_orders SET checkout_attempted_at=COALESCE(checkout_attempted_at,now()),updated_at=now() WHERE id=$1 AND status=\'pending\'',[id]);
   session=await request('','POST',order.checkout_payload,`upforit-ticket-order-${id}`);
  }
  validate(order,session);
  if((action==='cancel'||!canSell)&&session.status==='open'){session=await request('/'+encodeURIComponent(session.id)+'/expire','POST');validate(order,session);}
  const updated=(await db.query(`UPDATE ticket_orders SET stripe_checkout_session_id=$2,stripe_checkout_url=$3,checkout_state='ready',checkout_last_error=NULL,status=CASE WHEN status='pending' AND $4='expired' THEN 'expired' ELSE status END,updated_at=now() WHERE id=$1 AND (stripe_checkout_session_id IS NULL OR stripe_checkout_session_id=$2) RETURNING status`,[id,session.id,session.url,session.status])).rows[0];
  if(!updated)throw httpError(409,'Checkout association changed. Refresh this test.');
  await db.query("INSERT INTO ticket_audit_log(id,order_id,actor_user_id,action,details) VALUES($1,$2,$3,'admin_live_test_checkout',$4::jsonb)",[randomUUID(),id,user.id,JSON.stringify({action,status:session.status})]);
  return {orderId:id,url:action==='resume'&&updated.status==='pending'&&session.status==='open'?session.url:null,message:session.status==='complete'?'Payment submitted; awaiting the normal Stripe webhook.':'Checkout '+session.status+'.'};
 }finally{let discard=false;if(locked)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[`ticket-session:${id}`]).catch(()=>{discard=true;});db.release(discard);}
}
