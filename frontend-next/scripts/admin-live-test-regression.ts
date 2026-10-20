import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type pg from 'pg';
import {correlatePaidSession,recordRefund} from '../lib/ticket-payments';
import {fulfilPaidOrder} from '../lib/ticket-orders';
import {recoverTicketCheckout} from '../lib/ticket-checkout-recovery';
import {ticketPriceLines} from '../lib/ticket-pricing';
import {buildTicketPdf} from '../lib/ticket-document';
import {createTicketQrToken} from '../lib/security';
import QRCode from 'qrcode';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {RGBLuminanceSource,HybridBinarizer,BinaryBitmap,MultiFormatReader} from '@zxing/library';
import {insertEmailJob} from '../lib/email-jobs';
export async function adminLiveTestRegression(pool:pg.Pool){
 const {createLiveTest,operateLiveTest,liveTestData,priceTest}=await import(new URL('../../admin-service/live-ticket-test.mjs',import.meta.url).href);
 const {checkIn}=await import(new URL('../../admin-service/scanner.mjs',import.meta.url).href);
 await pool.query('CREATE TABLE IF NOT EXISTS signups(id serial PRIMARY KEY,email text UNIQUE NOT NULL,created_at timestamptz DEFAULT now())');
 await pool.query(await readFile(new URL('../../admin-service/schema.sql',import.meta.url),'utf8'));
 Object.assign(process.env,{ADMIN_LIVE_TICKET_TESTS_ENABLED:'true',APP_ENV:'production',STRIPE_SECRET_KEY:'sk_live_isolated_fake_key',TICKET_QR_SIGNING_SECRET:'local-scanner-signing-secret'});
 const user={id:randomUUID(),email:'admin-live@example.invalid'};
 await pool.query("INSERT INTO users(id,email,display_name,password_hash,role,email_verified_at) VALUES($1,$2,'Live test admin','unused','admin',now())",[user.id,user.email]);
 const event=randomUUID(),tier=randomUUID();
 await pool.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status,sales_open) VALUES($1,'nye-2026','NYE','Local',now()+interval '1 day',now()+interval '2 days','draft',false)",[event]);
 await pool.query("INSERT INTO ticket_types(id,event_id,name,price_minor,is_active,max_per_order,sales_end_at) VALUES($1,$2,'General release',1000,true,10,now()+interval '1 day')",[tier,event]);
 for(let q=1;q<=10;q++)assert.deepEqual(priceTest({slug:'nye-2026',currency:'gbp',price_minor:1000,capacity:null,max_per_order:10,name:'General release'},q),ticketPriceLines('nye-2026','General release',1000,q).map(l=>({name:l.name,quantity:l.quantity,unitPriceMinor:l.unitPriceMinor})));
 const sessions=new Map<string,any>(),calls:any[]=[];let lose=false;
 const stripe=async(path:string,method='GET',payload:any=null,key?:string)=>{
  calls.push({path,method,key});
  if(payload){const id=payload.client_reference_id;let session=sessions.get(id);if(!session){session={id:'cs_'+id,livemode:true,mode:'payment',payment_status:'unpaid',payment_intent:'pi_'+id,client_reference_id:id,metadata:payload.metadata,amount_total:payload.line_items.reduce((n:number,l:any)=>n+l.quantity*l.price_data.unit_amount,0),currency:'gbp',status:'open',url:'https://checkout.stripe.com/c/pay/'+id};sessions.set(id,session);}if(lose){lose=false;throw Error('simulated lost Stripe response');}return session;}
  const session=[...sessions.values()].find(s=>path.includes(s.id));assert.ok(session);if(path.endsWith('/expire'))session.status='expired';return session;
 };
 const body=(quantity=1)=>({action:'create',ticketTypeId:tier,quantity,requestId:randomUUID(),expectedTotalMinor:quantity===4?3000:1000,confirm:'LIVE PAYMENT'});
 const origin='https://admin.example.invalid';
 async function paid(id:string){const session=sessions.get(id);session.status='complete';session.payment_status='paid';session.url=null;const c=await pool.connect();try{await c.query('BEGIN');const correlated=await correlatePaidSession(c,session,Math.floor(Date.now()/1000));const f=await fulfilPaidOrder(c,correlated!.id,correlated!.pi);if(f)await insertEmailJob(c,'ticket_confirmation',{to:f.email,displayName:f.displayName,orderId:id},{userId:user.id,orderId:id});await c.query('COMMIT');return f;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 const draft=body(4);lose=true;await assert.rejects(createLiveTest(pool,user,draft,origin,stripe),/lost Stripe response/);
 const first=(await pool.query('SELECT order_id FROM ticket_admin_live_tests WHERE actor_user_id=$1',[user.id])).rows[0].order_id;
 assert.equal(sessions.size,1);await assert.rejects(createLiveTest(pool,user,body(),origin,stripe),/open checkout/);
 const resumed=await createLiveTest(pool,user,draft,origin,stripe);assert.equal(resumed.orderId,first);assert.equal(sessions.size,1);assert.equal(calls.filter(c=>c.method==='POST')[0].key,calls.filter(c=>c.method==='POST')[1].key);
 const other={id:randomUUID(),email:'other@example.invalid'};await assert.rejects(operateLiveTest(pool,other,first,'resume',stripe),/not found/);
 await recoverTicketCheckout(pool,{checkout:{sessions:{retrieve:async()=>sessions.get(first),expire:async()=>{throw Error('must not expire authorised test');}}}} as never,first,'reconcile');
 assert.ok(await paid(first));assert.equal(await paid(first),null);
 assert.equal((await pool.query('SELECT * FROM tickets WHERE order_id=$1',[first])).rowCount,4);assert.equal((await pool.query("SELECT * FROM email_jobs WHERE order_id=$1 AND job_type='ticket_confirmation'",[first])).rowCount,1);
 const ticket=(await pool.query('SELECT * FROM tickets WHERE order_id=$1 ORDER BY ticket_number',[first])).rows[0];
 const rows=(await pool.query(`SELECT o.order_number,u.display_name,e.title AS event_title,e.venue_name,e.starts_at,e.timezone,t.ticket_number,t.public_id,t.ticket_type_name FROM ticket_orders o JOIN users u ON u.id=o.user_id JOIN events e ON e.id=o.event_id JOIN tickets t ON t.order_id=o.id WHERE o.id=$1 ORDER BY t.ticket_number`,[first])).rows;
 const pdf=await PDFDocument.load(await buildTicketPdf(first,rows));assert.equal(pdf.getPageCount(),4);
 const token=createTicketQrToken(ticket.public_id),png=await QRCode.toBuffer(token,{width:512,margin:4});
 const raw=await sharp(png).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true});
 const code=new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(new Uint8ClampedArray(raw.data),raw.info.width,raw.info.height)))).getText();assert.equal(code,token);
 const principal={userId:user.id,scannerSessionId:null,deviceLabel:'Test admin'},scan={code,requestId:randomUUID()};
 const checked=await checkIn(pool,principal,scan);assert.equal(checked.ticket.status,'checked_in');assert.equal(checked.ticket.admin_live_test,true);assert.equal((await checkIn(pool,principal,scan)).replayed,true);await assert.rejects(checkIn(pool,principal,{code,requestId:randomUUID()}),/already been checked/);
 const c=await pool.connect();try{await c.query('BEGIN');await recordRefund(c,{payment_intent:'pi_'+first,id:'ch_'+first,amount:3000,amount_refunded:3000,currency:'gbp'} as never);await c.query('COMMIT');}finally{c.release();}
 await assert.rejects(checkIn(pool,principal,{code,requestId:randomUUID()}),/unavailable/);assert.equal((await pool.query("SELECT count(*)::int n FROM tickets WHERE order_id=$1 AND status='void'",[first])).rows[0].n,4);
 const cancelled=await createLiveTest(pool,user,body(),origin,stripe);await pool.query("UPDATE events SET status='cancelled' WHERE id=$1",[event]);assert.equal(await paid(cancelled.orderId),null);assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[cancelled.orderId])).rows[0].status,'refund_review');await pool.query("UPDATE events SET status='draft' WHERE id=$1",[event]);
 const expired=await createLiveTest(pool,user,body(),origin,stripe);await pool.query("UPDATE ticket_admin_live_tests SET authorised_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE order_id=$1",[expired.orderId]);assert.equal(await paid(expired.orderId),null);
 const toCancel=await createLiveTest(pool,user,body(),origin,stripe);await operateLiveTest(pool,user,toCancel.orderId,'cancel',stripe);assert.equal((await pool.query('SELECT status FROM ticket_orders WHERE id=$1',[toCancel.orderId])).rows[0].status,'expired');
 const data=await liveTestData(pool,user);assert.equal(data.orders.length,4);assert.ok(data.orders.find((o:any)=>o.id===first).tickets.every((t:any)=>t.status==='void'));assert.equal((await liveTestData(pool,other)).orders.length,0);
 await assert.rejects(createLiveTest(pool,user,{...body(),expectedTotalMinor:1},origin,stripe),/price changed/);
 // Concurrent same-intent requests cannot create two sessions.
 const concurrent=body();let release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
 const slow=async(...args:any[])=>{entered();await gate;return stripe(args[0],args[1],args[2],args[3]);};
 const firstRequest=createLiveTest(pool,user,concurrent,origin,slow);await started;
 await assert.rejects(createLiveTest(pool,user,concurrent,origin,stripe),/already being checked/);release();
 const concurrentOrder=await firstRequest;await operateLiveTest(pool,user,concurrentOrder.orderId,'cancel',stripe);
 // Provider identity/amount mismatch must not attach a session or issue tickets.
 const mismatched=body();await assert.rejects(createLiveTest(pool,user,mismatched,origin,async(...args:any[])=>({...await stripe(args[0],args[1],args[2],args[3]),amount_total:1})),/does not match/);
 const mismatchOrder=(await pool.query('SELECT id,stripe_checkout_session_id FROM ticket_orders WHERE user_id=$1 AND idempotency_key=$2',[user.id,'admin-live:'+mismatched.requestId])).rows[0];assert.equal(mismatchOrder.stripe_checkout_session_id,null);
 await operateLiveTest(pool,user,mismatchOrder.id,'cancel',stripe);
 await pool.query("UPDATE users SET role='customer' WHERE id=$1",[user.id]);await assert.rejects(createLiveTest(pool,user,body(),origin,stripe),/verified administrator/);await pool.query("UPDATE users SET role='admin' WHERE id=$1",[user.id]);
 process.env.ADMIN_LIVE_TICKET_TESTS_ENABLED='false';await assert.rejects(createLiveTest(pool,user,body(),origin,stripe),/disabled/);
 assert.deepEqual((await pool.query('SELECT status,sales_open FROM events WHERE id=$1',[event])).rows[0],{status:'draft',sales_open:false});
 console.log('PASS: admin live test isolation, pricing, actual four-page PDF, real QR image decoding, immutable retry, maintenance, issuance, email queue, scan consumption/replay/duplicates, cancellation, authorisation expiry, refunds and closed public sales');
}
