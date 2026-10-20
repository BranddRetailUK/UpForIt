// Isolated localhost database, no provider calls and no real emails.
import pg from 'pg';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {hash} from '../security.mjs';
const connection=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(connection.hostname))throw Error('Scanner tests require local PostgreSQL.');
const root=new pg.Client({connectionString:connection.href});await root.connect();
const name='upforit_scanner_test_'+Date.now(),key='isolated-scanner-test-key',origin='http://localhost:4312';
let db,server;
const code=id=>`v1.${id}.${createHmac('sha256',key).update(`v1.${id}`).digest('base64url')}`;
try{
 await root.query(`CREATE DATABASE ${name}`);connection.pathname='/'+name;db=new pg.Client({connectionString:connection.href});await db.connect();
 for(const file of (await readdir(new URL('../../frontend-next/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(new URL('../../frontend-next/migrations/'+file,import.meta.url),'utf8'));
 await db.query('CREATE TABLE signups(id serial PRIMARY KEY,email text UNIQUE NOT NULL,created_at timestamptz DEFAULT now())');
 const user=randomUUID(),token=randomBytes(32).toString('base64url'),cookie=`upforit_admin_session=${token}`;
 await db.query("INSERT INTO users(id,email,display_name,password_hash,role,email_verified_at) VALUES($1,'audit@example.invalid','Audit','unused','admin',now())",[user]);
 await db.query("INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[randomUUID(),user,hash(token)]);
 server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:connection.href,AUTH_RATE_LIMIT_SECRET:'audit-only',TICKET_QR_SIGNING_SECRET:key,PORT:'4312',ADMIN_ORIGIN:origin,NODE_ENV:'test',APP_ENV:'testing',SENDGRID_API_KEY:''},stdio:['ignore','pipe','pipe']});
 let errors='';server.stderr.on('data',v=>{errors+=v.toString();});
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===59)throw Error('Server failed: '+errors);}
 const request=(path,body,auth=cookie,sentOrigin=origin)=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{cookie:auth,...(body===undefined?{}:{'content-type':'application/json',origin:sentOrigin})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const scan=(ticket,requestId=randomUUID(),auth=cookie)=>request('/api/scanner/check-in',{code:code(ticket.publicId),requestId},auth);
 let counter=0;
 async function fixture(){
  const event=randomUUID(),tier=randomUUID(),order=randomUUID(),item=randomUUID(),ticket=randomUUID(),publicId=randomUUID();counter++;
  await db.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status) VALUES($1,$2,'Scanner test','Local',now()-interval '1 hour',now()+interval '2 hours','published')",[event,`scan-${event}`]);
  await db.query("INSERT INTO ticket_types(id,event_id,name,price_minor) VALUES($1,$2,'Admission',1000)",[tier,event]);
  await db.query("INSERT INTO ticket_orders(id,user_id,event_id,status,subtotal_minor,total_minor,idempotency_key,request_hash,reserved_until,paid_at,fulfilled_at,order_number) VALUES($1::uuid,$2,$3,'paid',1000,1000,$1::text,'test',now()+interval '1 day',now(),now(),$4)",[order,user,event,`TEST-${order}`]);
  await db.query("INSERT INTO ticket_order_items(id,order_id,ticket_type_id,ticket_type_name,unit_price_minor,quantity,line_total_minor) VALUES($1,$2,$3,'Admission',1000,1,1000)",[item,order,tier]);
  await db.query("INSERT INTO tickets(id,public_id,ticket_number,order_id,order_item_id,user_id,event_id,ticket_type_name,admission_index) VALUES($1,$2,$3,$4,$5,$6,$7,'Admission',1)",[ticket,publicId,`UFI-T-${String(counter).padStart(6,'0')}`,order,item,user,event]);
  return{event,order,ticket,publicId};
 }
 const first=await fixture(),second=await fixture();
 assert.equal((await request('/api/scanner/session',undefined,'')).status,401);
 assert.equal((await request('/api/scanner/check-in',{code:code(first.publicId),requestId:randomUUID()},cookie,'https://wrong.invalid')).status,403);
 assert.equal((await request('/api/scanner/check-in',{code:code(first.publicId)+'x',requestId:randomUUID()})).status,400);
 const id=randomUUID();assert.equal((await scan(first,id)).status,200);
 const replay=await scan(first,id);assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);
 assert.equal((await scan(first)).status,409);
 assert.equal((await scan(second)).status,200); // A different event, no event selection or eventId in either request.
 const concurrent=await fixture();assert.deepEqual((await Promise.all([scan(concurrent),scan(concurrent)])).map(r=>r.status).sort(),[200,409]);
 const held=await fixture();await db.query('UPDATE ticket_orders SET admissions_hold=true WHERE id=$1',[held.order]);assert.equal((await scan(held)).status,404);
 const refunded=await fixture();await db.query("UPDATE ticket_orders SET status='refunded' WHERE id=$1",[refunded.order]);assert.equal((await scan(refunded)).status,404);
 const voided=await fixture();await db.query("UPDATE tickets SET status='void' WHERE id=$1",[voided.ticket]);assert.equal((await scan(voided)).status,409);
 const ended=await fixture();await db.query("UPDATE events SET starts_at=now()-interval '5 hours',ends_at=now()-interval '3 hours' WHERE id=$1",[ended.event]);assert.equal((await scan(ended)).status,404);
 const cancelled=await fixture();await db.query("UPDATE events SET status='cancelled' WHERE id=$1",[cancelled.event]);assert.equal((await scan(cancelled)).status,404);
 const rehearsal=await fixture();await db.query("UPDATE events SET starts_at=now()+interval '1 day',ends_at=now()+interval '2 days' WHERE id=$1",[rehearsal.event]);assert.equal((await(await scan(rehearsal)).json()).validationOnly,true);assert.equal((await db.query('SELECT status FROM tickets WHERE id=$1',[rehearsal.ticket])).rows[0].status,'valid');
 const manual=await fixture();const number=(await db.query('SELECT ticket_number FROM tickets WHERE id=$1',[manual.ticket])).rows[0].ticket_number;
 assert.equal((await request('/api/scanner/check-in',{code:number,requestId:randomUUID()})).status,200);
 assert.equal((await request('/api/scanner/enrol',{})).status,200);
 // Use a known enrolment token in the isolated database to exercise the real activation endpoint.
 const enrolId=randomUUID(),enrolToken=randomBytes(32).toString('base64url');
 await db.query("INSERT INTO scanner_enrolments(id,event_id,created_by,token_hash,expires_at,max_devices) VALUES($1,$2,$3,$4,now()+interval '10 minutes',1)",[enrolId,first.event,user,hash(enrolToken)]);
 const activation=await request('/api/scanner/activate',{token:enrolToken,label:'Door test'},'');assert.equal(activation.status,200);
 const deviceCookie=activation.headers.get('set-cookie').split(';')[0];assert.ok(deviceCookie.startsWith('upforit_scanner='));
 assert.equal((await request('/api/scanner/activate',{token:enrolToken},'')).status,409);
 const otherEvent=await fixture();assert.equal((await scan(otherEvent,randomUUID(),deviceCookie)).status,200);
 assert.equal((await request('/api/scanner/devices',undefined,deviceCookie)).status,401);
 const device=(await db.query('SELECT id FROM scanner_sessions WHERE enrolment_id=$1',[enrolId])).rows[0];
 assert.equal((await request('/api/scanner/revoke',{id:device.id})).status,200);
 assert.equal((await scan(await fixture(),randomUUID(),deviceCookie)).status,401);
 assert.equal((await request('/api/scanner/enrol',{sessionId:device.id})).status,200);
 const html=await(await fetch(origin+'/scan')).text();assert.ok(!html.includes('<select'));assert.ok(html.includes('Scan QR code'));
 assert.equal((await fetch(origin+'/vendor/zxing-browser.min.js')).status,200);
 await db.query("UPDATE users SET role='customer' WHERE id=$1",[user]);assert.equal((await scan(await fixture())).status,401);
 console.log('PASS: event-free admin/delegated scans, signed QR, manual fallback, replay recovery, simultaneous scans, held/refunded/void/expired/cancelled rejection, rehearsal, same-origin/auth checks, enrolment, device limit, revocation, relink creation, role revocation, scanner HTML and camera bundle.');
}finally{
 if(server&&server.exitCode===null&&server.signalCode===null){const exit=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await exit;}
 if(db)await db.end();await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();
}
