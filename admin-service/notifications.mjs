import webpush from 'web-push';
import {ECDH} from 'node:crypto';
import {hash,httpError} from './security.mjs';

export const notificationTypes={
 sales:{body:'A new ticket sale is ready to review.',route:'tickets'},
 bucket:{body:'Someone has signed up for Blackley’s Bucket.',route:'bucket'},
 signups:{body:'A new user account has joined UPFORIT.',route:'accounts'}
};
export function pushConfiguration(env=process.env){
 const enabled=env.ADMIN_WEB_PUSH_ENABLED==='true'&&!!env.ADMIN_WEB_PUSH_PUBLIC_KEY&&!!env.ADMIN_WEB_PUSH_PRIVATE_KEY&&/^mailto:[^\s@]+@[^\s@]+$/.test(env.ADMIN_WEB_PUSH_SUBJECT||'');
 return {enabled,publicKey:enabled?env.ADMIN_WEB_PUSH_PUBLIC_KEY:null};
}
export function validateEndpoint(endpoint){
 if(typeof endpoint!=='string'||endpoint.length>2048)throw httpError(400,'Invalid notification device.');
 let url;try{url=new URL(endpoint);}catch{throw httpError(400,'Invalid notification device.');}
 const allowed=url.hostname.endsWith('.push.apple.com')||['fcm.googleapis.com','updates.push.services.mozilla.com'].includes(url.hostname);
 if(!allowed||url.protocol!=='https:'||url.port||url.username||url.password||url.hash)throw httpError(400,'Unsupported notification service.');
 return endpoint;
}
export function validateSubscription(value){
 const endpoint=validateEndpoint(value?.endpoint),keys=value?.keys||{};
 for(const [name,size] of [['p256dh',65],['auth',16]]){
  const key=keys[name];
  if(typeof key!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(key)||Buffer.from(key,'base64url').length!==size||Buffer.from(key,'base64url').toString('base64url')!==key.replace(/=+$/,''))throw httpError(400,'Invalid notification keys.');
 }
 try{ECDH.convertKey(Buffer.from(keys.p256dh,'base64url'),'prime256v1');}catch{throw httpError(400,'Invalid notification keys.');}
 return {endpoint,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export function validatePreferences(value){
 if(!value||Object.keys(value).some(k=>!Object.hasOwn(notificationTypes,k))||Object.keys(notificationTypes).some(k=>typeof value[k]!=='boolean'))throw httpError(400,'Choose your three notification preferences.');
 return Object.fromEntries(Object.keys(notificationTypes).map(k=>[k,value[k]]));
}
export async function savePushSubscription(db,userId,sessionHash,body){
 if(!pushConfiguration().enabled)throw httpError(503,'Notifications are not configured yet.');
 const subscription=validateSubscription(body.subscription),preferences=validatePreferences(body.preferences);
 // Saving/re-enabling starts a fresh opt-in window; no historical alert fanout.
 const result=await db.query(`INSERT INTO admin_push_subscriptions(user_id,endpoint_hash,subscription,preferences,session_hash)
  SELECT $1,$2,$3,$4,$5 WHERE EXISTS(SELECT 1 FROM user_sessions s JOIN users u ON u.id=s.user_id
   WHERE s.user_id=$1 AND s.token_hash=$5 AND s.expires_at>now()
    AND u.role='admin' AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL FOR SHARE OF s,u)
  ON CONFLICT(endpoint_hash) DO UPDATE SET user_id=EXCLUDED.user_id,
  subscription=EXCLUDED.subscription,preferences=EXCLUDED.preferences,session_hash=EXCLUDED.session_hash,
  active_since=now(),updated_at=now()`,[userId,hash(subscription.endpoint),subscription,preferences,sessionHash]);
 if(!result.rowCount)throw httpError(401,'Please sign in again to enable notifications.');
 return {enabled:true,preferences};
}
export async function pushDeviceStatus(db,userId,endpoint){
 validateEndpoint(endpoint);
 const row=(await db.query('SELECT preferences FROM admin_push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2',[userId,hash(endpoint)])).rows[0];
 return {enabled:!!row,preferences:row?.preferences||{sales:true,bucket:true,signups:true}};
}
export async function removePushSubscription(db,userId,endpoint){
 validateEndpoint(endpoint);await db.query('DELETE FROM admin_push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2',[userId,hash(endpoint)]);
 return {ok:true};
}
export async function removeSessionPush(db,userId,sessionHash,endpoint){
 const endpointHash=typeof endpoint==='string'&&endpoint.length<=2048?hash(endpoint):null;
 await db.query('DELETE FROM admin_push_subscriptions WHERE user_id=$1 AND (session_hash=$2 OR endpoint_hash=$3)',[userId,sessionHash,endpointHash]);
}
export async function logoutWithPush(pool,userId,sessionHash,endpoint){
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  // Subscription writes hold a share lock on this session. Delete it first so a
  // concurrent subscribe cannot recreate a device after logout cleanup.
  await db.query('DELETE FROM user_sessions WHERE user_id=$1 AND token_hash=$2',[userId,sessionHash]);
  await removeSessionPush(db,userId,sessionHash,endpoint);await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
export function pushPayload(kind,eventKey){
 const type=notificationTypes[kind];
 if(!type)throw Error('Unsupported notification type');
 return {kind,body:type.body,tag:'upforit-'+hash(eventKey).slice(0,32)};
}
export async function sendPush(subscription,payload,env=process.env){
 return webpush.sendNotification(validateSubscription(subscription),JSON.stringify(payload),{
  vapidDetails:{subject:env.ADMIN_WEB_PUSH_SUBJECT,publicKey:env.ADMIN_WEB_PUSH_PUBLIC_KEY,privateKey:env.ADMIN_WEB_PUSH_PRIVATE_KEY},
  TTL:3600,timeout:10000,urgency:'normal'
 });
}
export async function testPush(db,userId,endpoint,transport=sendPush){
 if(!pushConfiguration().enabled)throw httpError(503,'Notifications are not configured yet.');
 validateEndpoint(endpoint);
 const row=(await db.query('SELECT subscription FROM admin_push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2',[userId,hash(endpoint)])).rows[0];
 if(!row)throw httpError(404,'Enable notifications on this device first.');
 try{await transport(row.subscription,{kind:'test',body:'Your UpForIt ADMIN test notification.',tag:'upforit-test'});}
 catch(error){
  if([404,410].includes(error.statusCode)){await removePushSubscription(db,userId,endpoint);throw httpError(410,'This device subscription has expired. Enable notifications again.');}
  throw httpError(502,'The notification service could not confirm the test. Try again shortly.');
 }
 return {ok:true};
}
export async function capturePushEvents(pool){
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const lock=await db.query('SELECT pg_try_advisory_xact_lock(739128462) AS locked');
  if(!lock.rows[0].locked){await db.query('ROLLBACK');return;}
  await db.query('INSERT INTO admin_push_state(id) VALUES(1) ON CONFLICT DO NOTHING');
  await db.query(`INSERT INTO admin_push_events(event_key,kind,occurred_at)
   SELECT 'sale:'||o.id,'sales',o.paid_at FROM ticket_orders o,admin_push_state s
   WHERE s.id=1 AND o.paid_at>=GREATEST(s.started_at,now()-interval '24 hours')
    AND o.status='paid' AND o.total_minor>0
    AND NOT EXISTS(SELECT 1 FROM ticket_admin_live_tests t WHERE t.order_id=o.id)
    AND NOT EXISTS(SELECT 1 FROM ticket_audit_log a WHERE a.order_id=o.id AND a.action='admin_simulated_purchase')
   ON CONFLICT(event_key) DO NOTHING`);
  await db.query(`INSERT INTO admin_push_events(event_key,kind,occurred_at)
   SELECT 'bucket:'||b.id,'bucket',b.created_at FROM bucket_entries b,admin_push_state s
   WHERE s.id=1 AND b.created_at>=GREATEST(s.started_at,now()-interval '24 hours')
   ON CONFLICT(event_key) DO NOTHING`);
  await db.query(`INSERT INTO admin_push_events(event_key,kind,occurred_at)
   SELECT 'user:'||u.id,'signups',u.created_at FROM users u,admin_push_state s
   WHERE s.id=1 AND u.role='customer' AND u.disabled_at IS NULL
    AND u.created_at>=GREATEST(s.started_at,now()-interval '24 hours')
   ON CONFLICT(event_key) DO NOTHING`);
  await db.query(`INSERT INTO admin_push_deliveries(event_id,subscription_id)
   SELECT e.id,s.id FROM admin_push_events e JOIN admin_push_subscriptions s
    ON s.active_since<=e.occurred_at AND s.preferences->>e.kind='true'
   WHERE e.occurred_at>now()-interval '1 hour' ON CONFLICT DO NOTHING`);
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}
export async function deliverPushEvents(pool,transport=sendPush){
 let sent=0;
 for(let i=0;i<20;i++){
  const delivery=(await pool.query(`UPDATE admin_push_deliveries SET attempts=attempts+1,next_attempt_at=now()+interval '2 minutes'
   WHERE id=(SELECT id FROM admin_push_deliveries WHERE completed_at IS NULL AND attempts<5 AND next_attempt_at<=now()
    ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`)).rows[0];
  if(!delivery)break;
  const row=(await pool.query(`SELECT s.subscription,e.kind,e.event_key,
   (u.role='admin' AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL
    AND s.preferences->>e.kind='true' AND s.active_since<=e.occurred_at
    AND e.occurred_at>now()-interval '1 hour') AS permitted
   FROM admin_push_deliveries d JOIN admin_push_events e ON e.id=d.event_id
   JOIN admin_push_subscriptions s ON s.id=d.subscription_id JOIN users u ON u.id=s.user_id
   WHERE d.id=$1`,[delivery.id])).rows[0];
  let outcome='skipped';
  if(row?.permitted){
   try{await transport(row.subscription,pushPayload(row.kind,row.event_key));outcome='sent';sent++;}
   catch(error){
    const status=Number(error.statusCode)||0;
    if([404,410].includes(status)){await pool.query('DELETE FROM admin_push_subscriptions WHERE id=$1',[delivery.subscription_id]);continue;}
    // Retrying an ambiguous provider timeout may replace an existing OS alert;
    // the stable event tag prevents separate notifications for the same event.
    if((!status||status===429||status>=500)&&delivery.attempts<5){
     await pool.query('UPDATE admin_push_deliveries SET outcome=$2 WHERE id=$1',[delivery.id,'retry']);continue;
    }
    outcome='failed';console.warn('[admin-push] delivery failed',{status});
   }
  }
  await pool.query('UPDATE admin_push_deliveries SET completed_at=now(),outcome=$2 WHERE id=$1',[delivery.id,outcome]);
 }
 return sent;
}
export function startPushWorker(pool){
 if(!pushConfiguration().enabled)return ()=>{};
 let running=false;
 const tick=async()=>{
  if(running)return;running=true;
  try{await capturePushEvents(pool);await deliverPushEvents(pool);await pool.query("DELETE FROM admin_push_events WHERE created_at<now()-interval '7 days'");}
  catch{console.warn('[admin-push] worker failed');}finally{running=false;}
 };
 void tick();const timer=setInterval(tick,15000);timer.unref();return ()=>clearInterval(timer);
}
