import {recoveryRegression} from './ticket-recovery-regression';
// Creates and removes its own local database. No Stripe or email provider calls.
import pg from 'pg';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {correlatePaidSession,recordRefund} from '../lib/ticket-payments';
import {fulfilPaidOrder} from '../lib/ticket-orders';
import {classifyEmailSubmissionError,recordEmailFailure} from '../lib/email-failure';
import {decryptJson} from '../lib/security';

async function main(){
 const url=new URL(process.env.DATABASE_URL!);
 if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Local PostgreSQL required');
 process.env.EMAIL_JOB_ENCRYPTION_KEY='isolated-test-encryption-key-for-payment-review';
 const root=new pg.Client({connectionString:url.href});await root.connect();
 const name='ticket_priority_test_'+Date.now();let pool:pg.Pool|undefined;
 try{
  await root.query(`CREATE DATABASE ${name}`);url.pathname='/'+name;pool=new pg.Pool({connectionString:url.href});
  for(const file of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())await pool.query(await readFile('migrations/'+file,'utf8'));
  const user=randomUUID();await pool.query("INSERT INTO users(id,email,display_name,password_hash) VALUES($1,'test@example.invalid','Test Buyer','unused')",[user]);
  const now=Math.floor(Date.now()/1000);
  async function fixture(){
   const event=randomUUID(),tier=randomUUID(),order=randomUUID();
   await pool!.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status,sales_open) VALUES($1::uuid,$1::text,'Test','Local',now()+interval '1 day',now()+interval '2 days','published',true)",[event]);
   await pool!.query("UPDATE ticket_event_sales_history SET effective_at=to_timestamp($2) WHERE event_id=$1",[event,now-3600]);
   await pool!.query("INSERT INTO ticket_types(id,event_id,name,price_minor,sales_end_at) VALUES($1,$2,'Entry',1000,now()+interval '1 day')",[tier,event]);
   await pool!.query("INSERT INTO ticket_orders(id,user_id,event_id,subtotal_minor,total_minor,idempotency_key,request_hash,reserved_until) VALUES($1::uuid,$2,$3,1000,1000,$1::text,'test',now()+interval '1 hour')",[order,user,event]);
   await pool!.query("INSERT INTO ticket_order_items(id,order_id,ticket_type_id,ticket_type_name,unit_price_minor,quantity,line_total_minor) VALUES($1,$2,$3,'Entry',1000,1,1000)",[randomUUID(),order,tier]);
   return {event,tier,order,session:{id:'cs_'+order,mode:'payment',payment_status:'paid',payment_intent:'pi_'+order,amount_total:1000,currency:'gbp',metadata:{ticketOrderId:order},client_reference_id:order}};
  }
  async function pay(f:Awaited<ReturnType<typeof fixture>>,when=now){
   const c=await pool!.connect();try{await c.query('BEGIN');const match=await correlatePaidSession(c,f.session as never,when);const out=await fulfilPaidOrder(c,match!.id,match!.pi);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  async function held(f:Awaited<ReturnType<typeof fixture>>,reason:string){
   assert.equal(await pay(f),null);assert.equal(await pay(f),null);
   const o=(await pool!.query('SELECT * FROM ticket_orders WHERE id=$1',[f.order])).rows[0];
   assert.equal(o.status,'refund_review');assert.equal(o.admissions_hold,true);assert.equal(o.payment_review_reason,reason);assert.equal(o.fulfilled_at,null);
   assert.equal((await pool!.query('SELECT * FROM tickets WHERE order_id=$1',[f.order])).rowCount,0);
   const jobs=(await pool!.query('SELECT * FROM email_jobs WHERE order_id=$1',[f.order])).rows;
   assert.equal(jobs.length,1);assert.equal(jobs[0].job_type,'ticket_payment_review');assert.equal(decryptJson<{orderId:string}>(jobs[0].encrypted_payload).orderId,f.order);
  }
  const normal=await fixture();assert.ok(await pay(normal));assert.equal(await pay(normal),null);
  const cancelled=await fixture();await pool.query("UPDATE events SET status='cancelled' WHERE id=$1",[cancelled.event]);await held(cancelled,'event_unavailable');
  // Even after reopening, a reviewed payment cannot silently issue tickets on replay.
  await pool.query("UPDATE events SET status='published' WHERE id=$1",[cancelled.event]);await held(cancelled,'event_unavailable');
  const closed=await fixture();await pool.query('UPDATE events SET sales_open=false WHERE id=$1',[closed.event]);await pool.query('UPDATE ticket_event_sales_history SET effective_at=to_timestamp($2) WHERE event_id=$1 AND sales_open=false',[closed.event,now-1]);await held(closed,'sales_closed_at_payment');
  const late=await fixture();await pool.query('UPDATE events SET sales_open=false WHERE id=$1',[late.event]);assert.ok(await pay(late,now-60));
  const reopened=await fixture();await pool.query('UPDATE events SET sales_open=false WHERE id=$1',[reopened.event]);await pool.query("UPDATE ticket_event_sales_history SET effective_at=to_timestamp($2) WHERE event_id=$1 AND sales_open=false",[reopened.event,now-120]);await pool.query('UPDATE events SET sales_open=true WHERE id=$1',[reopened.event]);assert.equal(await pay(reopened,now-60),null);
  const cutoff=await fixture();await pool.query("UPDATE ticket_types SET sales_end_at=to_timestamp($2) WHERE id=$1",[cutoff.tier,now-1]);await held(cutoff,'sales_deadline_passed');
  const refunded=await fixture();const c=await pool.connect();try{await c.query('BEGIN');await recordRefund(c,{id:'ch_test',payment_intent:refunded.session.payment_intent,amount:1000,amount_refunded:1000,currency:'gbp'} as never);await c.query('COMMIT');}finally{c.release();}assert.equal(await pay(refunded),null);assert.equal((await pool.query('SELECT * FROM email_jobs WHERE order_id=$1',[refunded.order])).rowCount,0);
  const simultaneous=await fixture();const outcomes=await Promise.all([pay(simultaneous),pay(simultaneous)]);assert.equal(outcomes.filter(Boolean).length,1);assert.equal((await pool.query('SELECT * FROM tickets WHERE order_id=$1',[simultaneous.order])).rowCount,1);
  for(const [code,expected,attempts] of [[429,'failed',1],[400,'failed',5],[401,'failed',5],[500,'unknown',1],[408,'unknown',1]] as const){
   const id=randomUUID();await pool.query("INSERT INTO email_jobs(id,job_type,encrypted_payload,status,attempts,sending_at) VALUES($1,'verify_email','test','processing',1,now())",[id]);
   const error=classifyEmailSubmissionError(Object.assign(new Error('provider'),{code,response:{body:{}}}));await recordEmailFailure(pool,{id,attempts:1},error);
   const j: {status:string;attempts:number;sending_at:Date|null;backed_off:boolean}=(await pool.query('SELECT *,available_at>now() AS backed_off FROM email_jobs WHERE id=$1',[id])).rows[0];assert.equal(j.status,expected);assert.equal(j.attempts,attempts);assert.equal(j.sending_at===null,expected==='failed');assert.equal(j.backed_off,true);
   if(code===429){await pool.query("UPDATE email_jobs SET status='processing',attempts=2 WHERE id=$1",[id]);await recordEmailFailure(pool,{id,attempts:2},new Error('pre-send PDF failure'));assert.equal((await pool.query('SELECT status FROM email_jobs WHERE id=$1',[id])).rows[0].status,'failed');}
  }
  const exhausted=randomUUID();await pool.query("INSERT INTO email_jobs(id,job_type,encrypted_payload,status,attempts,sending_at) VALUES($1,'verify_email','test','processing',5,now())",[exhausted]);await recordEmailFailure(pool,{id:exhausted,attempts:5},classifyEmailSubmissionError(Object.assign(new Error('rate limit'),{code:429,response:{body:{}}})));assert.equal((await pool.query("SELECT id FROM email_jobs WHERE id=$1 AND status IN ('pending','failed') AND attempts<5",[exhausted])).rowCount,0);
  for(const sending of [false,true]){
   const id=randomUUID();await pool.query("INSERT INTO email_jobs(id,job_type,encrypted_payload,status,attempts,sending_at) VALUES($1,'verify_email','test','processing',1,CASE WHEN $2 THEN now() ELSE NULL END)",[id,sending]);await recordEmailFailure(pool,{id,attempts:1},new Error(sending?'database failure after acceptance':'PDF failure'));assert.equal((await pool.query('SELECT status FROM email_jobs WHERE id=$1',[id])).rows[0].status,sending?'unknown':'failed');
  }
  const racing=await fixture();const closer=await pool.connect();
  try{
   await closer.query('BEGIN');await closer.query("UPDATE events SET status='cancelled' WHERE id=$1",[racing.event]);
   const pendingPay=pay(racing);
   await new Promise(resolve=>setTimeout(resolve,100));await closer.query('COMMIT');assert.equal(await pendingPay,null);
   assert.equal((await pool.query('SELECT * FROM tickets WHERE order_id=$1',[racing.order])).rowCount,0);
  }finally{await closer.query('ROLLBACK');closer.release();}
  const callback=randomUUID();await pool.query("INSERT INTO email_jobs(id,job_type,encrypted_payload,status,attempts,sending_at) VALUES($1,'verify_email','test','delivered',1,now())",[callback]);await recordEmailFailure(pool,{id:callback,attempts:1},new Error('lost response'));assert.equal((await pool.query('SELECT status FROM email_jobs WHERE id=$1',[callback])).rows[0].status,'delivered');
  if(process.argv.includes('--recovery'))await recoveryRegression(pool,fixture,user,pay);
  console.log('PASS: payment closure history, cancellation, review deduplication, deadlines, refunds, concurrent fulfilment, email rejections/backoff/ambiguity/callback races');
 }finally{await pool?.end();await root.query(`DROP DATABASE IF EXISTS ${name}`);await root.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
