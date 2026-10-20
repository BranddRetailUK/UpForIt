import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {recoverTicketCheckout} from '../lib/ticket-checkout-recovery';
import {resendTickets} from '../lib/ticket-resend';

type Fixture={event:string;tier:string;order:string;session:Record<string,unknown>};
export async function recoveryRegression(pool:Pool,fixture:()=>Promise<Fixture>,user:string,pay:(f:never)=>Promise<unknown>){
 const {mutate}=await import(new URL('../../admin-service/data.mjs',import.meta.url).href);
 const {reconcileCheckout}=await import(new URL('../../admin-service/checkout-recovery.mjs',import.meta.url).href);
 const now=Math.floor(Date.now()/1000);
 await pool.query('CREATE TABLE IF NOT EXISTS admin_audit_log(id uuid PRIMARY KEY,actor_id uuid NOT NULL,action text NOT NULL,subject_id text,details jsonb,created_at timestamptz DEFAULT now())');
 async function checkout(attempted=false,expiry=now+3600){
  const f=await fixture();await pool.query("UPDATE ticket_orders SET checkout_payload=$2::jsonb,checkout_attempted_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1",[f.order,JSON.stringify({mode:'payment',expires_at:expiry,client_reference_id:f.order,metadata:{ticketOrderId:f.order}}),attempted]);return f;
 }
 function provider(f:Fixture,initial:Record<string,unknown>[]=[]){
  let creates=0,lists=0;const sessions=[...initial];
  const sdk={checkout:{sessions:{
   async list(){lists++;return {data:sessions,has_more:false};},
   async create(payload:Record<string,unknown>,options:{idempotencyKey:string}){creates++;assert.equal(options.idempotencyKey,`upforit-ticket-order-${f.order}`);const session={...f.session,status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/test',expires_at:payload.expires_at};sessions.push(session);return session;},
   async retrieve(id:string){const match=sessions.find(s=>s.id===id);assert.ok(match);return match;},
   async expire(id:string){const match=sessions.find(s=>s.id===id)!;match.status='expired';match.url=null;return match;}
  }}};
  return {sdk,sessions,get creates(){return creates;},get lists(){return lists;}};
 }
 const legacyDefault=await fixture();assert.ok((await pool.query('SELECT checkout_attempted_at FROM ticket_orders WHERE id=$1',[legacyDefault.order])).rows[0].checkout_attempted_at,'Legacy inserts must default to an uncertain attempt during rollout');
 const fresh=await checkout(false,now-7200),freshStripe=provider(fresh);
 assert.ok('url' in await recoverTicketCheckout(pool,freshStripe.sdk as never,fresh.order,'resume',user));assert.equal(freshStripe.creates,1);
 const persisted=(await pool.query('SELECT checkout_payload,checkout_attempted_at FROM ticket_orders WHERE id=$1',[fresh.order])).rows[0];assert.ok(persisted.checkout_attempted_at);assert.ok(persisted.checkout_payload.expires_at>now+1800);
 const cancel=await checkout(),cancelStripe=provider(cancel);assert.equal((await recoverTicketCheckout(pool,cancelStripe.sdk as never,cancel.order,'cancel',user)).code,'checkout_finished');assert.equal(cancelStripe.creates,0);
 const notStarted=await checkout(),notStartedStripe=provider(notStarted);assert.equal((await recoverTicketCheckout(pool,notStartedStripe.sdk as never,notStarted.order,'reconcile')).code,'checkout_ready');assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[notStarted.order])).rows[0].status,'pending');
 const lost=await checkout(true,now-7200),lostStripe=provider(lost,[{...lost.session,status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/recovered'}]);assert.ok('url' in await recoverTicketCheckout(pool,lostStripe.sdk as never,lost.order,'resume',user));assert.equal(lostStripe.creates,0);assert.equal(lostStripe.lists,1);
 const absent=await checkout(true,now-7200),absentStripe=provider(absent);assert.equal((await recoverTicketCheckout(pool,absentStripe.sdk as never,absent.order,'cancel',user)).code,'checkout_finished');assert.equal(absentStripe.creates,0);assert.equal(absentStripe.lists,1);
 const uncertain=await checkout(true,now+600),uncertainStripe=provider(uncertain);assert.equal((await recoverTicketCheckout(pool,uncertainStripe.sdk as never,uncertain.order,'resume',user)).code,'checkout_review');assert.equal(uncertainStripe.creates,0);assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[uncertain.order])).rows[0].status,'pending');
 const aged=await checkout(true),agedStripe=provider(aged);await pool.query("UPDATE ticket_orders SET checkout_attempted_at=now()-interval '25 hours' WHERE id=$1",[aged.order]);assert.equal((await recoverTicketCheckout(pool,agedStripe.sdk as never,aged.order,'resume',user)).code,'checkout_review');assert.equal(agedStripe.creates,0);
 const wrong=await checkout(true,now-7200),wrongStripe=provider(wrong,[{...wrong.session,amount_total:1,status:'expired'}]);await assert.rejects(()=>recoverTicketCheckout(pool,wrongStripe.sdk as never,wrong.order,'reconcile'));assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[wrong.order])).rows[0].status,'pending');
 const complete=await checkout(true),completeStripe=provider(complete,[{...complete.session,status:'complete',url:null}]);assert.equal((await recoverTicketCheckout(pool,completeStripe.sdk as never,complete.order,'cancel',user)).code,'payment_confirming');assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[complete.order])).rows[0].status,'pending');
 const unavailable=await checkout();await pool.query("UPDATE events SET sales_open=false WHERE id=$1",[unavailable.event]);const unavailableStripe=provider(unavailable);assert.equal((await recoverTicketCheckout(pool,unavailableStripe.sdk as never,unavailable.order,'resume',user)).code,'checkout_finished');assert.equal(unavailableStripe.creates,0);
 const incomplete=await checkout(true,now-7200);const incompleteStripe=provider(incomplete);incompleteStripe.sdk.checkout.sessions.list=async()=>({data:[],has_more:true});await assert.rejects(()=>recoverTicketCheckout(pool,incompleteStripe.sdk as never,incomplete.order,'reconcile'));assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[incomplete.order])).rows[0].status,'pending');
 const concurrent=await checkout(),concurrentStripe=provider(concurrent);let release!:(v:unknown)=>void;let entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});const originalCreate=concurrentStripe.sdk.checkout.sessions.create;concurrentStripe.sdk.checkout.sessions.create=async(...args)=>{entered();await new Promise(r=>{release=r;});return originalCreate(...args);};const first=recoverTicketCheckout(pool,concurrentStripe.sdk as never,concurrent.order,'resume',user);await started;await assert.rejects(()=>recoverTicketCheckout(pool,concurrentStripe.sdk as never,concurrent.order,'cancel',user),/being checked/);release(null);await first;assert.equal(concurrentStripe.creates,1);
 // Both resend entry points must treat retryable failures and unknown sends as busy.
 for(const status of ['failed','unknown','sent']){
  const f=await fixture();await pay(f as never);await pool.query("INSERT INTO email_jobs(id,job_type,order_id,encrypted_payload,status,attempts,created_at,available_at) VALUES($1,'ticket_confirmation',$2,'test',$3,1,now()-interval '1 hour',now()+interval '1 hour')",[randomUUID(),f.order,status]);
  if(status==='sent')await pool.query('UPDATE email_jobs SET sent_at=now() WHERE order_id=$1',[f.order]);
  const db=await pool.connect();try{await db.query('BEGIN');await assert.rejects(()=>resendTickets(db,f.order,user,true));await db.query('ROLLBACK');}finally{db.release();}
  await assert.rejects(()=>mutate(pool,{id:user},'/api/resend',{id:f.order}));assert.equal((await pool.query('SELECT * FROM email_jobs WHERE order_id=$1',[f.order])).rowCount,1);
 }
 const adminMissing=await checkout(true,now-7200);await reconcileCheckout(pool,{id:user},adminMissing.order,async()=>({data:[],has_more:false}));assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[adminMissing.order])).rows[0].status,'expired');assert.equal((await pool.query('SELECT * FROM admin_audit_log WHERE subject_id=$1',[adminMissing.order])).rowCount,1);
 const adminWrong=await checkout(true,now-7200);await assert.rejects(()=>reconcileCheckout(pool,{id:user},adminWrong.order,async()=>({data:[{...adminWrong.session,currency:'usd',status:'expired'}],has_more:false})));assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[adminWrong.order])).rows[0].status,'pending');
 console.log('PASS: checkout durable attempts, stale expiry, lost responses, cancellation, incomplete/mismatched Stripe results, key expiry, concurrent recovery, both resend endpoints, audited admin reconciliation');
}
