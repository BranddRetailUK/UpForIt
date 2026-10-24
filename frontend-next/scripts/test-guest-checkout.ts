// Real PostgreSQL and application routes, with Stripe replaced in memory.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
import {NextRequest} from 'next/server';
import {getPool} from '../lib/db';
import {getStripe} from '../lib/stripe';
import {decryptJson,createTicketQrToken} from '../lib/security';
import {guestDownloadToken} from '../lib/ticket-guest-access';
import {POST as checkout} from '../app/api/tickets/checkout/route';
import {POST as webhook} from '../app/api/stripe/tickets-webhook/route';
import {POST as login} from '../app/api/auth/login/route';
import {GET as verify} from '../app/api/auth/verify/route';
import {POST as verificationSession} from '../app/api/auth/verification-session/route';
import {POST as register} from '../app/api/auth/register/route';
import {GET as confirmation} from '../app/api/tickets/confirmation/route';
import {GET as pdf} from '../app/api/tickets/orders/[orderId]/pdf/route';
import {POST as recover} from '../app/api/tickets/orders/[orderId]/checkout/route';
import {getTicketDocumentRows} from '../lib/ticket-document';
import {createSessionForUser,SESSION_COOKIE} from '../lib/auth';
async function main(){
 const url=new URL(process.env.DATABASE_URL!);if(url.hostname!=='127.0.0.1'||url.port!=='55451')throw Error('Isolated local PostgreSQL required');
 const root=new pg.Client({connectionString:url.href});await root.connect();const name='guest_checkout_'+Date.now();let db:pg.Pool|undefined;
 try{
  await root.query(`CREATE DATABASE ${name}`);url.pathname='/'+name;
  Object.assign(process.env,{DATABASE_URL:url.href,APP_ENV:'testing',PUBLIC_TICKET_SALES_OPEN:'true',TICKETING_ENABLED:'true',NEXT_PUBLIC_SITE_URL:'http://localhost:3000',AUTH_RATE_LIMIT_SECRET:'guest-local-rate-key',EMAIL_JOB_ENCRYPTION_KEY:'guest-local-encryption-key',TICKET_QR_SIGNING_SECRET:'guest-local-qr-key',STRIPE_SECRET_KEY:'sk_test_local_no_network',STRIPE_TICKETS_WEBHOOK_SECRET:'whsec_local_no_network'});
  db=getPool();for(const f of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile('migrations/'+f,'utf8'));
  const stripe=getStripe(),sessions=new Map<string,any>();let creations=0;
  stripe.checkout.sessions.create=(async(p:any)=>{creations++;const s={id:'cs_'+p.client_reference_id,client_reference_id:p.client_reference_id,metadata:p.metadata,mode:'payment',payment_status:'unpaid',status:'open',currency:'gbp',amount_total:p.line_items.reduce((n:number,l:any)=>n+l.quantity*l.price_data.unit_amount,0),url:'https://example.invalid/'+p.client_reference_id,payment_intent:'pi_'+p.client_reference_id};sessions.set(s.id,s);return s;}) as any;
  stripe.checkout.sessions.retrieve=(async(id:string)=>sessions.get(id)) as any;
  stripe.checkout.sessions.list=(async()=>({data:[...sessions.values()],has_more:false})) as any;
  stripe.checkout.sessions.expire=(async(id:string)=>{const s=sessions.get(id);s.status='expired';s.url=null;return s;}) as any;
  const event=randomUUID(),tier=randomUUID();await db.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status,sales_open,merch_discount_enabled) VALUES($1,'nye-2026','Guest integration','Local',now()+interval '1 hour',now()+interval '1 day','published',true,true)",[event]);await db.query("INSERT INTO ticket_types(id,event_id,name,price_minor,max_per_order,is_active) VALUES($1,$2,'Admission',1000,10,true)",[tier,event]);
  const token=randomBytes(32).toString('hex'),cookie='upforit_guest_checkout='+token;
  const body={idempotencyKey:randomUUID(),items:[{ticketTypeId:tier,quantity:4}],guest:{name:'Guest Buyer',email:'guest@example.invalid'},guestToken:token};
  function post(path:string,b:unknown,c='',origin='http://localhost:3000'){return new NextRequest('http://localhost:3000'+path,{method:'POST',headers:{origin,cookie:c,'content-type':'application/json'},body:JSON.stringify(b)});}
  function get(path:string,c=''){return new NextRequest('http://localhost:3000'+path,{headers:{cookie:c}});}
  assert.equal((await checkout(post('/api/tickets/checkout',body,'','https://evil.invalid'))).status,403);
  for(const guest of [{name:'',email:'guest@example.invalid'},{name:'Guest',email:'invalid'}])assert.equal((await checkout(post('/api/tickets/checkout',{...body,guest}))).status,400);
  const source={version:1,source:'ig',medium:'paid_social',campaign:'nye-2026',landingPath:'/events/nye-2026',capturedAt:new Date().toISOString()};
  const sourceCookie='upforit_order_source='+encodeURIComponent(JSON.stringify(source));
  const first=await checkout(post('/api/tickets/checkout',body,sourceCookie));assert.equal(first.status,200,await first.clone().text());assert.match(first.headers.get('set-cookie')!,/HttpOnly/);const orderId=(await first.json()).orderId;
  const persisted=(await db.query('SELECT * FROM ticket_orders WHERE id=$1',[orderId])).rows[0];assert.equal(persisted.source_attribution,null);assert.equal(persisted.user_id,null);assert.equal(persisted.guest_name,'Guest Buyer');assert.equal(persisted.total_minor,3000);assert.equal((await db.query('SELECT * FROM users')).rowCount,0);
  assert.equal((await checkout(post('/api/tickets/checkout',body,cookie))).status,200);assert.equal(creations,1);
  assert.equal((await checkout(post('/api/tickets/checkout',{...body,guest:{...body.guest,email:'changed@example.invalid'}},cookie))).status,409);
  const pending=await checkout(post('/api/tickets/checkout',{...body,idempotencyKey:randomUUID()},cookie));assert.equal(pending.status,409);assert.equal((await pending.json()).pendingOrderId,orderId);
  assert.equal((await confirmation(get('/api/tickets/confirmation?session_id=cs_'+orderId))).status,404);assert.equal((await confirmation(get('/api/tickets/confirmation?session_id=cs_'+orderId,cookie))).status,200);
  assert.equal((await pdf(get('/api/tickets/orders/'+orderId+'/pdf'),{params:Promise.resolve({orderId})})).status,404);
  const session=sessions.get('cs_'+orderId);session.status='complete';session.payment_status='paid';
  async function pay(targetId=orderId){const targetSession=sessions.get('cs_'+targetId);targetSession.status='complete';targetSession.payment_status='paid';const payload=JSON.stringify({id:'evt_'+targetId,type:'checkout.session.completed',livemode:false,created:Math.floor(Date.now()/1000),data:{object:targetSession}});return webhook(new NextRequest('http://localhost:3000/api/stripe/tickets-webhook',{method:'POST',headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_TICKETS_WEBHOOK_SECRET!})},body:payload}));}
  assert.equal((await pay()).status,200);assert.equal((await pay()).status,200);assert.equal((await db.query('SELECT * FROM tickets WHERE order_id=$1',[orderId])).rowCount,4);
  const jobs=(await db.query("SELECT * FROM email_jobs WHERE order_id=$1 AND job_type='ticket_confirmation'",[orderId])).rows;assert.equal(jobs.length,1);assert.equal(decryptJson<any>(jobs[0].encrypted_payload).to,'guest@example.invalid');
  assert.equal((await db.query('SELECT * FROM merch_discount_entitlements WHERE source_ticket_order_id=$1',[orderId])).rowCount,0);
  const rows=await getTicketDocumentRows(orderId);assert.equal(rows.length,4);assert.equal(rows[0].display_name,'Guest Buyer');assert.equal(rows[0].guest,true);
  const ready=await confirmation(get('/api/tickets/confirmation?session_id=cs_'+orderId,cookie));assert.equal((await ready.json()).guest,true);
  const download=await pdf(get('/api/tickets/orders/'+orderId+'/pdf',cookie),{params:Promise.resolve({orderId})});assert.equal(download.status,200);assert.ok((await download.arrayBuffer()).byteLength>1000);
  const signed=guestDownloadToken(orderId);assert.equal((await pdf(get('/api/tickets/orders/'+orderId+'/pdf?guest_token='+signed),{params:Promise.resolve({orderId})})).status,200);
  assert.equal((await pdf(get('/api/tickets/orders/'+orderId+'/pdf?guest_token='+signed.slice(0,-1)+(signed.endsWith('x')?'y':'x')),{params:Promise.resolve({orderId})})).status,404);
  const admin=randomUUID();await db.query("INSERT INTO users(id,email,display_name,password_hash,role,email_verified_at) VALUES($1,'admin@example.invalid','Test Admin','unused','admin',now())",[admin]);
  // @ts-expect-error Dedicated admin service is native JavaScript.
  const {checkIn}=await import('../../admin-service/scanner.mjs');
  assert.ok(await checkIn(db,{userId:admin,scannerSessionId:null,deviceLabel:'Test'},{code:createTicketQrToken(rows[0].public_id),requestId:randomUUID()}));await assert.rejects(()=>checkIn(db!,{userId:admin,scannerSessionId:null,deviceLabel:'Test'},{code:createTicketQrToken(rows[0].public_id),requestId:randomUUID()}));
  const signupBody={email:body.guest.email,displayName:'Account Buyer',password:'isolated-test-password',confirmPassword:'isolated-test-password',next:'/events/nye-2026#tickets'};
  const registration=await register(post('/api/auth/register',signupBody));assert.equal(registration.status,200);
  assert.equal((await register(post('/api/auth/register',signupBody))).status,409);
  assert.equal((await login(post('/api/auth/login',signupBody))).status,403);
  const handoff={token:(await registration.json()).signupSessionToken};
  assert.equal((await (await verificationSession(post('/api/auth/verification-session',handoff))).json()).verified,false);
  const user=(await db.query('SELECT id FROM users WHERE email=$1',[body.guest.email])).rows[0];assert.equal((await db.query('SELECT user_id FROM ticket_orders WHERE id=$1',[orderId])).rows[0].user_id,null);
  const userSession=await createSessionForUser(db,user.id);let userCookie=SESSION_COOKIE+'='+userSession.token;const userBody={idempotencyKey:randomUUID(),items:[{ticketTypeId:tier,quantity:1}]};
  assert.equal((await checkout(post('/api/tickets/checkout',userBody,userCookie))).status,403);const verificationJob=(await db.query("SELECT encrypted_payload FROM email_jobs WHERE user_id=$1 AND job_type='verify_email'",[user.id])).rows[0];
  const verificationLink=decryptJson<{url:string}>(verificationJob.encrypted_payload).url;
  const verified=await verify(new NextRequest(verificationLink));assert.equal(verified.headers.get('location'),'http://localhost:3000/events/nye-2026#tickets');assert.ok(verified.cookies.get(SESSION_COOKIE));
  assert.match((await verify(new NextRequest(verificationLink))).headers.get('location')!,/invalid-token/);
  const handoffResponse=await verificationSession(post('/api/auth/verification-session',handoff));assert.equal((await handoffResponse.json()).verified,true);assert.ok(handoffResponse.cookies.get(SESSION_COOKIE));
  assert.equal((await verificationSession(post('/api/auth/verification-session',handoff))).status,410);
  assert.equal((await login(post('/api/auth/login',{...signupBody,password:'incorrect-password'}))).status,401);
  const signedIn=await login(post('/api/auth/login',signupBody));assert.equal(signedIn.status,200);assert.ok(signedIn.cookies.get(SESSION_COOKIE));userCookie=SESSION_COOKIE+'='+signedIn.cookies.get(SESSION_COOKIE)!.value;assert.equal((await checkout(post('/api/tickets/checkout',userBody,userCookie))).status,200);assert.equal((await confirmation(get('/api/tickets/confirmation?session_id=cs_'+orderId,userCookie))).status,404);
  const next=await checkout(post('/api/tickets/checkout',{...body,idempotencyKey:randomUUID()},cookie+'; '+sourceCookie+'; upforit_meta_consent=granted'));assert.equal(next.status,200);const nextId=(await next.json()).orderId;assert.equal((await db.query('SELECT source_attribution FROM ticket_orders WHERE id=$1',[nextId])).rows[0].source_attribution.campaign,'nye-2026');
  const savedKey=(await db.query('SELECT idempotency_key FROM ticket_orders WHERE id=$1',[nextId])).rows[0].idempotency_key;await checkout(post('/api/tickets/checkout',{...body,idempotencyKey:savedKey},cookie));assert.equal((await db.query('SELECT source_attribution FROM ticket_orders WHERE id=$1',[nextId])).rows[0].source_attribution.source,'ig');
  assert.equal((await recover(post('/api/tickets/orders/'+nextId+'/checkout',{action:'cancel'},userCookie),{params:Promise.resolve({orderId:nextId})})).status,404);
  const cancelled=await recover(post('/api/tickets/orders/'+nextId+'/checkout',{action:'cancel'},cookie+'; '+userCookie),{params:Promise.resolve({orderId:nextId})});assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).orderStatus,'expired');
  // Audit edge cases, using only this disposable database and fake Stripe.
  const expiredChanged=await checkout(post('/api/tickets/checkout',{...body,idempotencyKey:(await db.query('SELECT idempotency_key FROM ticket_orders WHERE id=$1',[nextId])).rows[0].idempotency_key,guest:{name:'Guest Buyer',email:'corrected@example.invalid'}},cookie));
  const expiredChangedBody=await expiredChanged.json();
  assert.equal(expiredChanged.status,409);assert.equal(expiredChangedBody.canStartNew,true);assert.equal(expiredChangedBody.orderStatus,'expired');assert.equal(expiredChangedBody.pendingOrderId,undefined);
  console.log('PASS: expired guest order with changed details allows an explicit new purchase');
  const accountOrder=(await db.query('SELECT id FROM ticket_orders WHERE user_id=$1',[user.id])).rows[0].id;
  const loggedOut=await confirmation(get('/api/tickets/confirmation?session_id=cs_'+accountOrder));
  assert.equal(loggedOut.status,401);
  console.log('PASS: logged-out account confirmation requests sign-in');
  assert.equal((await checkout(post('/api/tickets/checkout',userBody,userCookie))).status,200);
  assert.equal((await pay(accountOrder)).status,200);assert.equal((await pay(accountOrder)).status,200);
  assert.equal((await db.query('SELECT * FROM tickets WHERE order_id=$1',[accountOrder])).rowCount,1);
  assert.equal((await db.query("SELECT * FROM email_jobs WHERE order_id=$1 AND job_type='ticket_confirmation'",[accountOrder])).rowCount,1);
  assert.equal((await db.query('SELECT * FROM merch_discount_entitlements WHERE source_ticket_order_id=$1',[accountOrder])).rowCount,1);
  assert.equal((await confirmation(get('/api/tickets/confirmation?session_id=cs_'+accountOrder,userCookie))).status,200);
  assert.equal((await pdf(get('/api/tickets/orders/'+accountOrder+'/pdf',userCookie),{params:Promise.resolve({orderId:accountOrder})})).status,200);
  assert.equal((await pdf(get('/api/tickets/orders/'+accountOrder+'/pdf',cookie),{params:Promise.resolve({orderId:accountOrder})})).status,404);
  await recover(post('/api/tickets/orders/'+accountOrder+'/checkout',{action:'cancel'},userCookie),{params:Promise.resolve({orderId:accountOrder})});
  const transitionBody={...body,idempotencyKey:randomUUID()};
  const transitionGuest=await checkout(post('/api/tickets/checkout',transitionBody,cookie));assert.equal(transitionGuest.status,200);
  const transitionAccount=await checkout(post('/api/tickets/checkout',transitionBody,cookie+'; '+userCookie));assert.equal(transitionAccount.status,409);
  const transitionId=(await transitionGuest.json()).orderId;
  assert.equal((await transitionAccount.json()).pendingOrderId,transitionId);
  const afterSignin=await checkout(post('/api/tickets/checkout',{idempotencyKey:randomUUID(),items:body.items},cookie+'; '+userCookie));assert.equal(afterSignin.status,409);assert.equal((await afterSignin.json()).pendingOrderId,transitionId);
  assert.equal((await db.query('SELECT * FROM ticket_orders WHERE idempotency_key=$1',[transitionBody.idempotencyKey])).rowCount,1);
  const resumed=await recover(post('/api/tickets/orders/'+transitionId+'/checkout',{action:'resume'},cookie+'; '+userCookie),{params:Promise.resolve({orderId:transitionId})});assert.equal((await resumed.json()).url,sessions.get('cs_'+transitionId).url);
  await recover(post('/api/tickets/orders/'+transitionId+'/checkout',{action:'cancel'},cookie+'; '+userCookie),{params:Promise.resolve({orderId:transitionId})});
  const newAccountPurchase=await checkout(post('/api/tickets/checkout',{idempotencyKey:randomUUID(),items:body.items},cookie+'; '+userCookie));assert.equal(newAccountPurchase.status,200);
  assert.equal((await db.query('SELECT guest_access_hash FROM ticket_orders WHERE id=$1',[(await newAccountPurchase.json()).orderId])).rows[0].guest_access_hash,null);
  console.log('PASS: signing in preserves the guest order and allows a new account purchase only after cancellation');
  const raceToken=randomBytes(32).toString('hex'),raceCookie='upforit_guest_checkout='+raceToken;
  const raceBody={...body,idempotencyKey:randomUUID(),guestToken:raceToken,guest:{name:'Race Buyer',email:'race@example.invalid'}};
  const beforeRace=creations;
  const racingGuest=await checkout(post('/api/tickets/checkout',raceBody,raceCookie));assert.equal(racingGuest.status,200);const raceId=(await racingGuest.json()).orderId;
  const raceResponses=await Promise.all([
    checkout(post('/api/tickets/checkout',raceBody,raceCookie)),
    checkout(post('/api/tickets/checkout',raceBody,raceCookie+'; '+userCookie)),
    checkout(post('/api/tickets/checkout',{...raceBody,idempotencyKey:randomUUID()},raceCookie+'; '+userCookie))
  ]);
  assert.equal(raceResponses[1].status,409);assert.equal(raceResponses[2].status,409);
  assert.equal(creations,beforeRace+1);
  assert.equal((await db.query('SELECT * FROM ticket_orders WHERE guest_access_hash=$1',[(await db.query('SELECT guest_access_hash FROM ticket_orders WHERE id=$1',[raceId])).rows[0].guest_access_hash])).rowCount,1);
  console.log('PASS: concurrent guest retries and signed-in requests create only one guest Stripe session');
  const freshToken=randomBytes(32).toString('hex'),failureBody={...body,idempotencyKey:randomUUID(),guestToken:freshToken,guest:{name:'Failure Buyer',email:'failure@example.invalid'}};
  const create=stripe.checkout.sessions.create;stripe.checkout.sessions.create=(async(...args:Parameters<typeof create>)=>{await create(...args);throw Error('Simulated lost Stripe response');}) as any;
  const failed=await checkout(post('/api/tickets/checkout',failureBody));stripe.checkout.sessions.create=create;
  assert.equal(failed.status,503);assert.equal(failed.cookies.get('upforit_guest_checkout')?.value,freshToken);assert.match(failed.headers.get('set-cookie')!,/HttpOnly/);
  const changedAfterFailure=await checkout(post('/api/tickets/checkout',{...failureBody,guest:{...failureBody.guest,email:'corrected-failure@example.invalid'}}));
  const failedOrder=(await changedAfterFailure.json()).pendingOrderId;assert.ok(failedOrder);assert.equal(changedAfterFailure.cookies.get('upforit_guest_checkout')?.value,freshToken);
  const inaccessibleRecovery=await recover(post('/api/tickets/orders/'+failedOrder+'/checkout',{action:'cancel'},'upforit_guest_checkout='+freshToken),{params:Promise.resolve({orderId:failedOrder})});assert.equal(inaccessibleRecovery.status,200);assert.equal((await inaccessibleRecovery.json()).orderStatus,'expired');
  const correctedRetry=await checkout(post('/api/tickets/checkout',{...failureBody,idempotencyKey:randomUUID(),guest:{...failureBody.guest,email:'corrected-failure@example.invalid'}},'upforit_guest_checkout='+freshToken));assert.equal(correctedRetry.status,200);
  console.log('PASS: lost Stripe response and changed details preserve guest access, cancellation and retry');
  console.log('PASS: guest validation, same-origin, group pricing, no account creation/linking, idempotency, webhook replay, email queue, PDF/scoped downloads, access isolation, door scanning, signup, verification gate, signed-in checkout and guest cancellation.');
 }finally{await db?.end();await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
