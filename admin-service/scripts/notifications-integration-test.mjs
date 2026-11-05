// Disposable LOCAL database; all notification delivery uses a fake transport.
import pg from 'pg';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createECDH} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {capturePushEvents,deliverPushEvents,savePushSubscription,pushDeviceStatus,removePushSubscription,logoutWithPush} from '../notifications.mjs';
const connection=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(connection.hostname))throw Error('Use local PostgreSQL only.');
const root=new pg.Client({connectionString:connection.href});await root.connect();
const name='upforit_push_test_'+Date.now();let pool;
try{
 await root.query(`CREATE DATABASE ${name}`);connection.pathname='/'+name;pool=new pg.Pool({connectionString:connection.href});
 for(const file of (await readdir(new URL('../../frontend-next/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pool.query(await readFile(new URL('../../frontend-next/migrations/'+file,import.meta.url),'utf8'));
 await pool.query(await readFile(new URL('../notifications.sql',import.meta.url),'utf8'));
 const admin=randomUUID(),customer=randomUUID(),session=randomBytes(32).toString('hex');
 await pool.query(`INSERT INTO users(id,email,display_name,password_hash,role,email_verified_at,created_at) VALUES
  ($1,'admin@example.test','Admin','unused','admin',now(),now()-interval '1 day'),
  ($2,'old@example.test','Old user','unused','customer',now(),now()-interval '1 day')`,[admin,customer]);
 await pool.query('INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval \'1 hour\')',[randomUUID(),admin,session]);
 const key=createECDH('prime256v1');key.generateKeys();
 const sub={endpoint:'https://web.push.apple.com/local-test',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 process.env.ADMIN_WEB_PUSH_ENABLED='true';process.env.ADMIN_WEB_PUSH_PUBLIC_KEY=key.getPublicKey().toString('base64url');process.env.ADMIN_WEB_PUSH_PRIVATE_KEY=key.getPrivateKey().toString('base64url');process.env.ADMIN_WEB_PUSH_SUBJECT='mailto:info@example.test';
 await capturePushEvents(pool);assert.equal((await pool.query('SELECT * FROM admin_push_events')).rowCount,0,'no first-start historical blast');
 await savePushSubscription(pool,admin,session,{subscription:sub,preferences:{sales:true,bucket:true,signups:true}});
 const event=randomUUID(),tier=randomUUID();
 await pool.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status) VALUES($1,'push-test','Test','Test',now(),now()+interval '1 day','published')",[event]);
 await pool.query("INSERT INTO ticket_types(id,event_id,name,price_minor) VALUES($1,$2,'Ticket',1000)",[tier,event]);
 async function order({status='paid',amount=1000,old=false,simulated=false,liveTest=false}={}){
  const id=randomUUID(),item=randomUUID(),ticket=randomUUID();
  await pool.query(`INSERT INTO ticket_orders(id,user_id,event_id,status,subtotal_minor,total_minor,idempotency_key,request_hash,reserved_until,paid_at,order_number)
   VALUES($1::uuid,$2,$3,$4,$5,$5,$1::text,'test',now(),CASE WHEN $4='pending' THEN NULL ELSE now()-($6*interval '1 hour') END,$1::text)`,[id,customer,event,status,amount,old?48:0]);
  await pool.query("INSERT INTO ticket_order_items(id,order_id,ticket_type_id,ticket_type_name,unit_price_minor,quantity,line_total_minor) VALUES($1,$2,$3,'Ticket',$4,1,$4)",[item,id,tier,amount]);
  await pool.query("INSERT INTO tickets(id,public_id,ticket_number,order_id,order_item_id,user_id,event_id,ticket_type_name,admission_index) VALUES($1::uuid,$2,$1::text,$3,$4,$5,$6,'Ticket',1)",[ticket,randomUUID(),id,item,customer,event]);
  if(simulated)await pool.query("INSERT INTO ticket_audit_log(id,actor_user_id,order_id,action) VALUES($1,$2,$3,'admin_simulated_purchase')",[randomUUID(),admin,id]);
  if(liveTest)await pool.query("INSERT INTO ticket_admin_live_tests(order_id,actor_user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[id,admin]);
  return {id,ticket};
 }
 const paid=await order();const pending=await order({status:'pending'});
 await order({amount:0});await order({old:true});await order({simulated:true});await order({liveTest:true});
 const entrant=randomUUID();
 await pool.query("INSERT INTO users(id,email,display_name,password_hash) VALUES($1,'new@example.test','New user','unused')",[entrant]);
 await pool.query("INSERT INTO bucket_entries(id,event_id,user_id,ticket_id,dj_name) VALUES($1,$2,$3,$4,'Test DJ')",[randomUUID(),event,entrant,paid.ticket]);
 await Promise.all([capturePushEvents(pool),capturePushEvents(pool)]);
 const events=(await pool.query('SELECT kind,count(*)::int n FROM admin_push_events GROUP BY kind ORDER BY kind')).rows;
 assert.deepEqual(events,[{kind:'bucket',n:1},{kind:'sales',n:1},{kind:'signups',n:1}]);
 const sent=[];await Promise.all([deliverPushEvents(pool,async(s,p)=>sent.push(p)),deliverPushEvents(pool,async(s,p)=>sent.push(p))]);assert.equal(sent.length,3);
 await capturePushEvents(pool);await deliverPushEvents(pool,async()=>assert.fail('duplicate send'));assert.equal(sent.length,3);
 await pool.query("UPDATE ticket_orders SET status='paid',paid_at=now() WHERE id=$1",[pending.id]);await capturePushEvents(pool);
 let attempts=0;await deliverPushEvents(pool,async()=>{attempts++;throw Object.assign(Error('temporary'),{statusCode:503});});assert.equal(attempts,1);
 await pool.query("UPDATE admin_push_deliveries SET next_attempt_at=now() WHERE outcome='retry'");await deliverPushEvents(pool,async(s,p)=>sent.push(p));assert.equal(sent.length,4);
 await savePushSubscription(pool,admin,session,{subscription:sub,preferences:{sales:false,bucket:false,signups:true}});
 await order();await capturePushEvents(pool);await deliverPushEvents(pool,async()=>assert.fail('disabled category sent'));
 assert.equal((await pushDeviceStatus(pool,admin,sub.endpoint)).preferences.sales,false);
 await savePushSubscription(pool,admin,session,{subscription:sub,preferences:{sales:true,bucket:true,signups:true}});
 await capturePushEvents(pool);await deliverPushEvents(pool,async()=>assert.fail('historical opt-in replay'));
 await order();await capturePushEvents(pool);await pool.query("UPDATE users SET role='customer' WHERE id=$1",[admin]);
 await deliverPushEvents(pool,async()=>assert.fail('revoked admin sent'));
 await pool.query("UPDATE users SET role='admin' WHERE id=$1",[admin]);
 await order();await capturePushEvents(pool);await deliverPushEvents(pool,async()=>{throw Object.assign(Error('gone'),{statusCode:410});});
 assert.equal((await pushDeviceStatus(pool,admin,sub.endpoint)).enabled,false);
 await savePushSubscription(pool,admin,session,{subscription:sub,preferences:{sales:true,bucket:true,signups:true}});
 await removePushSubscription(pool,customer,sub.endpoint);assert.equal((await pushDeviceStatus(pool,admin,sub.endpoint)).enabled,true,'another account cannot remove device');
 await logoutWithPush(pool,admin,session,sub.endpoint);assert.equal((await pool.query('SELECT * FROM admin_push_subscriptions')).rowCount,0);
 await assert.rejects(savePushSubscription(pool,admin,session,{subscription:sub,preferences:{sales:true,bucket:true,signups:true}}),{status:401});
 console.log('Push integration passed: event sources, first-enable baseline, concurrency, deduplication, retry, preferences, role revocation, expired endpoints and logout. No real pushes sent.');
}finally{if(pool)await pool.end();await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();}
