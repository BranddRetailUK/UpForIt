// Refuses all but the disposable local bucket database.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {NextRequest} from 'next/server';
import {getPool} from '../lib/db';
import {createSession,type AuthUser} from '../lib/auth';
import {bucketStatus,enterBucket,administerBucket,adminBucketData} from '../lib/bucket';
import {validateBucketEntry} from '../lib/bucket-shared';
import {GET,POST} from '../app/api/bucket/route';
import {GET as adminGet,POST as adminPost} from '../app/api/admin/bucket/route';
async function main(){
 if(process.env.DATABASE_URL!=='postgresql://bucket_test@127.0.0.1:55441/postgres')throw new Error('Disposable local bucket DB required');
 process.env.AUTH_RATE_LIMIT_SECRET='disposable-bucket-rate-secret';
 const db=getPool(),event=randomUUID(),tier=randomUUID(),users:AuthUser[]=[],orders:string[]=[],ticketIds:string[]=[],tokens:string[]=[];
 const origin='http://localhost:3000';
 function req(path:string,body?:unknown,who=0,foreign=false){return new NextRequest(origin+path,{method:body===undefined?'GET':'POST',headers:{origin:foreign?'https://evil.invalid':origin,'content-type':'application/json',...(tokens[who]?{cookie:`upforit_session=${tokens[who]}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
 try{
 await db.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status) VALUES($1,'nye-2026','Bucket test','Test',now()+interval '1 day',now()+interval '2 days','published')",[event]);
 await db.query("INSERT INTO ticket_types(id,event_id,name,price_minor) VALUES($1,$2,'Admission',1000)",[tier,event]);
 for(let i=0;i<12;i++){
  const id=randomUUID();const u:AuthUser={id,email:`bucket-${id}@example.invalid`,displayName:`DJ ${i}`,role:i===0?'admin':'customer',emailVerified:i!==11};users.push(u);
  await db.query("INSERT INTO users(id,email,display_name,password_hash,role,email_verified_at) VALUES($1,$2,$3,'unused',$4,$5)",[id,u.email,u.displayName,u.role,u.emailVerified?new Date():null]);tokens.push((await createSession(id)).token);
  const order=randomUUID(),item=randomUUID(),ticket=randomUUID();orders.push(order);ticketIds.push(ticket);
  await db.query("INSERT INTO ticket_orders(id,user_id,event_id,status,subtotal_minor,total_minor,idempotency_key,request_hash,reserved_until,paid_at,order_number) VALUES($1::uuid,$2,$3,'paid',1000,1000,$1::text,'test',now()+interval '1 day',now(),$4)",[order,id,event,`TEST-${order}`]);
  await db.query("INSERT INTO ticket_order_items(id,order_id,ticket_type_id,ticket_type_name,unit_price_minor,quantity,line_total_minor) VALUES($1,$2,$3,'Admission',1000,1,1000)",[item,order,tier]);
  await db.query("INSERT INTO tickets(id,public_id,ticket_number,order_id,order_item_id,user_id,event_id,ticket_type_name,admission_index) VALUES($1,$2,$3,$4,$5,$6,$7,'Admission',1)",[ticket,randomUUID(),`TEST-${ticket}`,order,item,id,event]);
 }
 await db.query("UPDATE events SET status='draft' WHERE id=$1",[event]);assert.equal((await bucketStatus(null)).state,'upcoming');await assert.rejects(enterBucket(users[0],'Too early'));
 await db.query("UPDATE events SET status='published' WHERE id=$1",[event]);assert.equal((await bucketStatus(null)).state,'signed-out');assert.equal((await bucketStatus(users[0])).state,'eligible');assert.equal((await bucketStatus(users[11])).state,'verify-email');
 for(const input of [{djName:' ',consent:true},{djName:'A'.repeat(81),consent:true},{djName:'DJ',consent:false}])assert.throws(()=>validateBucketEntry(input));
 assert.equal(validateBucketEntry({djName:' DJ Test ',consent:true}),'DJ Test');
 assert.equal((await POST(req('/api/bucket',{djName:'DJ',consent:true},99))).status,401);
 assert.equal((await POST(req('/api/bucket',{djName:'DJ',consent:true},0,true))).status,403);
 assert.equal((await POST(req('/api/bucket',{djName:'DJ',consent:true},11))).status,403);
 assert.equal((await adminGet(req('/api/admin/bucket',undefined,1))).status,403);
 assert.equal((await adminPost(req('/api/admin/bucket',{action:'draw'},1))).status,403);
 for(const status of ['pending','refunded','refund_review']){
  await db.query('UPDATE ticket_orders SET status=$2,admissions_hold=$3 WHERE id=$1',[orders[1],status,status==='refund_review']);
  assert.equal((await bucketStatus(users[1])).state,'no-ticket');await assert.rejects(enterBucket(users[1],'No ticket'));
 }
 await db.query("UPDATE ticket_orders SET status='refund_review',admissions_hold=false WHERE id=$1",[orders[1]]);assert.equal((await bucketStatus(users[1])).state,'eligible');
 await db.query("UPDATE ticket_orders SET status='paid' WHERE id=$1",[orders[1]]);
 await db.query("UPDATE tickets SET status='void' WHERE id=$1",[ticketIds[1]]);assert.equal((await bucketStatus(users[1])).state,'no-ticket');
 await db.query("UPDATE tickets SET status='checked_in' WHERE id=$1",[ticketIds[1]]);assert.equal((await bucketStatus(users[1])).state,'eligible');
 const posts=await Promise.all(Array.from({length:5},()=>POST(req('/api/bucket',{djName:'DJ Concurrent',consent:true,userId:users[1].id,ticketId:ticketIds[1]}))));assert.ok(posts.every(r=>r.status===200));
 assert.equal((await db.query('SELECT count(*)::int n FROM bucket_entries WHERE user_id=$1',[users[0].id])).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM bucket_entries WHERE user_id=$1',[users[1].id])).rows[0].n,0);
 const saved=await(await GET(req('/api/bucket'))).json();assert.equal(saved.djName,'DJ Concurrent');assert.equal(saved.state,'entered');assert.equal('email' in saved,false);
 await db.query('UPDATE ticket_orders SET admissions_hold=true WHERE id=$1',[orders[0]]);assert.equal((await bucketStatus(users[0])).state,'ticket-inactive');assert.equal((await adminBucketData()).entries[0].eligible,false);
 await db.query('UPDATE ticket_orders SET admissions_hold=false WHERE id=$1',[orders[0]]);await assert.rejects(administerBucket(users[0].id,'draw'),/first two hours/);
 for(let i=1;i<10;i++)await enterBucket(users[i],`DJ ${i}`);
 await db.query('UPDATE users SET disabled_at=now() WHERE id=$1',[users[9].id]);
 await db.query("UPDATE events SET starts_at=now()-interval '1 minute' WHERE id=$1",[event]);assert.equal((await bucketStatus(users[10])).state,'closed');await assert.rejects(enterBucket(users[10],'Too late'));
 const draws=await Promise.allSettled([administerBucket(users[0].id,'draw'),administerBucket(users[0].id,'draw')]);assert.equal(draws.filter(r=>r.status==='fulfilled').length,1);
 const first=(await adminBucketData()).entries.find(e=>e.status==='called')!;await administerBucket(users[0].id,'skipped',first.id);
 for(let i=0;i<8;i++){await administerBucket(users[0].id,'draw');const called=(await adminBucketData()).entries.find(e=>e.status==='called')!;assert.notEqual(called.id,first.id);assert.notEqual(called.dj_name,'DJ 9');await administerBucket(users[0].id,'played',called.id);}
 await assert.rejects(administerBucket(users[0].id,'draw'),/eight/);assert.equal((await adminBucketData()).entries.filter(e=>e.status==='played').length,8);
 const csv=await adminGet(req('/api/admin/bucket?export=csv'));assert.equal(csv.status,200);assert.ok((await csv.text()).includes('DJ Concurrent'));
 await db.query("UPDATE events SET starts_at=now()-interval '3 hours' WHERE id=$1",[event]);await assert.rejects(administerBucket(users[0].id,'draw'),/first two hours/);
 console.log('PASS: validation, auth, CSRF, admin access, ticket states, partial refunds, concurrent submissions, ownership, persistence, revoked eligibility, cutoff, concurrent draws, skipped/disabled exclusions, eight-slot cap and CSV.');
 }finally{
  await db.query('DELETE FROM bucket_audit WHERE entry_id IN (SELECT id FROM bucket_entries WHERE event_id=$1)',[event]);await db.query('DELETE FROM bucket_entries WHERE event_id=$1',[event]);await db.query('DELETE FROM tickets WHERE event_id=$1',[event]);await db.query('DELETE FROM ticket_orders WHERE event_id=$1',[event]);await db.query('DELETE FROM ticket_types WHERE event_id=$1',[event]);await db.query('DELETE FROM events WHERE id=$1',[event]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users.map(u=>u.id)]);await db.end();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
