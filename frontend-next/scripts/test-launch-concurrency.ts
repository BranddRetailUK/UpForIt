// Isolated real-PostgreSQL audit. Stripe is replaced in memory; no payments or emails are sent.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
import {NextRequest} from 'next/server';
import {getPool} from '../lib/db';
import {createSessionForUser} from '../lib/auth';
import {getStripe} from '../lib/stripe';
import {POST as checkout} from '../app/api/tickets/checkout/route';
import {POST as webhook} from '../app/api/stripe/tickets-webhook/route';
import {POST as bucket} from '../app/api/bucket/route';

async function main(){
 const url=new URL(process.env.DATABASE_URL!);
 if(url.hostname!=='127.0.0.1'||url.port!=='55449')throw Error('Disposable local server on port 55449 required');
 const root=new pg.Client({connectionString:url.href});await root.connect();
 const name='launch_concurrency_'+Date.now();let db:pg.Pool|undefined;
 try{
  await root.query(`CREATE DATABASE ${name}`);url.pathname='/'+name;
  Object.assign(process.env,{DATABASE_URL:url.href,APP_ENV:'testing',PUBLIC_TICKET_SALES_OPEN:'true',TICKETING_ENABLED:'true',NEXT_PUBLIC_SITE_URL:'http://localhost:3000',AUTH_RATE_LIMIT_SECRET:'local-concurrency-rate-secret',EMAIL_JOB_ENCRYPTION_KEY:'local-concurrency-encryption-key-long-enough',STRIPE_SECRET_KEY:'sk_test_local_no_network',STRIPE_TICKETS_WEBHOOK_SECRET:'whsec_local_no_network'});
  db=getPool();for(const f of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile('migrations/'+f,'utf8'));
  const stripe=getStripe(),sessions=new Map<string,any>();let creations=0;
  stripe.checkout.sessions.create=(async(p:any)=>{
   await new Promise(r=>setTimeout(r,25));creations++;
   const session={id:'cs_'+p.client_reference_id,client_reference_id:p.client_reference_id,metadata:p.metadata,mode:'payment',payment_status:'unpaid',status:'open',currency:'gbp',amount_total:p.line_items.reduce((s:number,l:any)=>s+l.quantity*l.price_data.unit_amount,0),url:'https://example.invalid/checkout/'+p.client_reference_id,payment_intent:'pi_'+p.client_reference_id};sessions.set(session.id,session);return session;
  }) as any;
  stripe.checkout.sessions.retrieve=(async(id:string)=>sessions.get(id)) as any;
  stripe.checkout.sessions.list=(async()=>({data:[...sessions.values()],has_more:false})) as any;
  const event=randomUUID(),tier=randomUUID();
  await db.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status,sales_open,merch_discount_enabled) VALUES($1,'nye-2026','Concurrency audit','Local only',now()+interval '1 day',now()+interval '2 days','published',true,true)",[event]);
  await db.query("INSERT INTO ticket_types(id,event_id,name,price_minor,max_per_order,is_active) VALUES($1,$2,'Admission',1000,10,true)",[tier,event]);
  const buyers:{id:string;token:string}[]=[];
  for(let i=0;i<160;i++){const id=randomUUID();await db.query("INSERT INTO users(id,email,display_name,password_hash,email_verified_at) VALUES($1,$2,'Local buyer','unused',now())",[id,id+'@example.invalid']);buyers.push({id,token:(await createSessionForUser(db,id)).token});}
  function request(i:number,path:string,body:unknown,ip=`192.0.2.${i+1}`){return new NextRequest('http://localhost:3000'+path,{method:'POST',headers:{origin:'http://localhost:3000','x-forwarded-for':ip,cookie:'upforit_session='+buyers[i].token,'content-type':'application/json'},body:JSON.stringify(body)});}
  const buy=(i:number,key=randomUUID(),type=tier,quantity=4)=>checkout(request(i,'/api/tickets/checkout',{idempotencyKey:key,items:[{ticketTypeId:type,quantity}]}));
  async function burst(label:string,count:number,fn:(i:number)=>Promise<unknown>){const start=Date.now();const result=await Promise.all(Array.from({length:count},(_,i)=>fn(i)));console.log(label+': '+(Date.now()-start)+'ms');return result;}
  const purchases=await burst('100 simultaneous independent checkouts',100,i=>buy(i)) as Response[];
  assert.deepEqual(purchases.map(r=>r.status),Array(100).fill(200));assert.equal(creations,100);
  assert.equal((await db.query('SELECT count(*)::int n FROM ticket_orders')).rows[0].n,100);
  const key=randomUUID();const repeats=await burst('10 same-account duplicate requests',10,()=>buy(100,key)) as Response[];
  assert.ok(repeats.every(r=>[200,409].includes(r.status)));assert.ok(repeats.some(r=>r.status===200));
  assert.equal((await db.query('SELECT count(*)::int n FROM ticket_orders WHERE user_id=$1',[buyers[100].id])).rows[0].n,1);assert.equal(creations,101);
  const different=await burst('10 same-account different checkout keys',10,()=>buy(101)) as Response[];
  assert.equal(different.filter(r=>r.status===200).length,1);assert.ok(different.every(r=>[200,409].includes(r.status)));assert.equal(creations,102);
  async function pay(s:any,eventId:string){const payload=JSON.stringify({id:eventId,type:'checkout.session.completed',livemode:false,created:Math.floor(Date.now()/1000),data:{object:{...s,status:'complete',payment_status:'paid'}}});return webhook(new NextRequest('http://localhost:3000/api/stripe/tickets-webhook',{method:'POST',headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_TICKETS_WEBHOOK_SECRET!})},body:payload}));}
  const all=[...sessions.values()];
  const payments=await burst('306 concurrent payment callbacks (102 orders, replayed and distinct event IDs)',306,i=>pay(all[Math.floor(i/3)],'evt_'+all[Math.floor(i/3)].id+'_'+(i%3===2?'second':'first'))) as Response[];
  assert.ok(payments.every(r=>r.status===200));
  assert.equal((await db.query('SELECT count(*)::int n FROM tickets')).rows[0].n,408);
  assert.equal((await db.query("SELECT count(*)::int n FROM email_jobs WHERE job_type='ticket_confirmation'")).rows[0].n,102);
  assert.equal((await db.query("SELECT count(*)::int n FROM ticket_orders WHERE status='paid' AND total_minor=3000")).rows[0].n,102);
  assert.equal((await db.query('SELECT id FROM ticket_orders GROUP BY id HAVING count(*)>1')).rowCount,0);
  assert.equal((await db.query('SELECT ticket_number FROM tickets GROUP BY ticket_number HAVING count(*)>1')).rowCount,0);
  assert.equal((await db.query('SELECT t.id FROM tickets t JOIN ticket_orders o ON o.id=t.order_id WHERE t.user_id<>o.user_id')).rowCount,0);
  const entries=await burst('100 simultaneous Bucket entries',100,i=>bucket(request(i,'/api/bucket',{djName:'DJ '+i,fullName:'Test Buyer',attendance:true,consent:true}))) as Response[];
  assert.ok(entries.every(r=>r.status===200));
  const duplicates=await burst('10 duplicate Bucket submissions',10,()=>bucket(request(100,'/api/bucket',{djName:'Repeat DJ',fullName:'Test Buyer',attendance:true,consent:true}))) as Response[];
  assert.ok(duplicates.every(r=>r.status===200));assert.equal((await db.query('SELECT count(*)::int n FROM bucket_entries')).rows[0].n,101);
  assert.equal((await db.query('SELECT count(*)::int n FROM bucket_entries WHERE user_id=$1',[buyers[100].id])).rows[0].n,1);
  // Finite stock uses the same checkout code, on a separate event because NYE deliberately requires unlimited stock.
  const finite=randomUUID(),finiteTier=randomUUID();
  await db.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status,sales_open) VALUES($1,$2,'Limited audit','Local only',now()+interval '1 day',now()+interval '2 days','published',true)",[finite,finite]);
  await db.query("INSERT INTO ticket_types(id,event_id,name,price_minor,capacity,is_active) VALUES($1,$2,'Limited',1000,10,true)",[finiteTier,finite]);
  const limited=await burst('50 buyers competing for 10 remaining tickets',50,i=>buy(110+i,randomUUID(),finiteTier,1)) as Response[];
  assert.equal(limited.filter(r=>r.status===200).length,10);assert.equal(limited.filter(r=>r.status===409).length,40);
  assert.equal((await db.query('SELECT sum(i.quantity)::int n FROM ticket_order_items i JOIN ticket_orders o ON o.id=i.order_id WHERE o.event_id=$1',[finite])).rows[0].n,10);
  console.log('PASS: separate buyer orders; group pricing; same/different-key duplication; payment replay; unique tickets; one email per order; Bucket isolation and deduplication; finite stock cannot oversell. No external calls.');
 }finally{if(db)await db.end();await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
