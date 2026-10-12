// Uses an isolated temporary database on the existing LOCAL Postgres only.
import pg from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {saveCampaign,queueCampaign,ingestEvents,campaignList,audienceSQL,deliverOne,defaults,unsubscribe} from '../campaigns.mjs';
const connection=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(connection.hostname))throw Error('Integration tests require local PostgreSQL.');
const root=new pg.Client({connectionString:connection.href});await root.connect();
const name='upforit_admin_test_'+Date.now();let db,server;
try{
 await root.query(`CREATE DATABASE ${name}`);connection.pathname='/'+name;db=new pg.Client({connectionString:connection.href});await db.connect();
 for(const name of ['001_native_ticketing.sql','009_single_general_release_ticket.sql','010_mix_competition.sql'])await db.query(await readFile(new URL('../../frontend-next/migrations/'+name,import.meta.url),'utf8'));
 await db.query('CREATE TABLE signups(id serial PRIMARY KEY,email text UNIQUE NOT NULL,created_at timestamptz DEFAULT now())');
 const admin=randomUUID(),customer=randomUUID(),entry=randomUUID(),password=randomBytes(24).toString('base64url'),passwordHash=await bcrypt.hash(password,10);
 await db.query(`INSERT INTO users(id,email,display_name,password_hash,role,email_verified_at) VALUES($1,'admin@example.com','Test Admin',$3,'admin',now()),($2,'customer@example.com','Test Customer',$3,'customer',now())`,[admin,customer,passwordHash]);
 await db.query(`INSERT INTO signups(email) VALUES('signup@example.com')`);
 await db.query(`INSERT INTO mix_entries(id,competition_id,user_id,artist,title,genre,email,source,source_url) VALUES($1,'nye-2026',$2,'Test DJ','Test Mix','UKG','dj@example.com','Link','https://soundcloud.com/example/mix')`,[entry,customer]);
 const origin='http://localhost:4311';server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:connection.href,AUTH_RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),PORT:'4311',ADMIN_ORIGIN:origin,NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
 let serverError='';server.stderr.on('data',d=>{serverError+=d.toString();process.stderr.write(d);});
 for(let i=0;i<60;i++){try{const r=await fetch(origin+'/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===59)throw Error('Server did not start: '+serverError);}
 const request=(path,body,cookie='',sentOrigin=origin)=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json',Origin:sentOrigin})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 for(const path of ['/api/dashboard','/api/analytics','/api/traffic','/api/campaigns','/api/campaign?id=00000000-0000-4000-8000-000000000000','/api/export?type=signups'])assert.equal((await request(path)).status,401);
 assert.equal((await request('/api/login',{email:'admin@example.com',password},'','https://evil.example.com')).status,403);
 assert.equal((await request('/api/login',{email:'customer@example.com',password})).status,401);
 const login=await request('/api/login',{email:'admin@example.com',password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
 assert.equal((await request('/api/traffic?days=999',undefined,cookie)).status,400);
 let r=await request('/api/dashboard',undefined,cookie);assert.equal(r.status,200);let d=await r.json();assert.equal(d.entries.length,1);assert.equal(d.subscribers.length,1);
 assert.equal((await request('/api/subscriber',{id:d.subscribers[0].id,status:'Unsubscribed'},cookie)).status,200);
 assert.equal((await request('/api/entry',{id:entry,artist:'Reviewed DJ',title:'Test Mix',genre:'UKG',email:'dj@example.com',status:'hidden',reviewed:true,allow_download:false},cookie)).status,200);
 assert.equal((await request('/api/settings',{submissions:false,voting:false,close:'2026-11-01T00:00:00Z',voteClose:'2026-11-02T00:00:00Z',announce:'2026-11-03T00:00:00Z'},cookie)).status,200);
 d=await (await request('/api/dashboard',undefined,cookie)).json();assert.equal(d.subscribers[0].status,'Unsubscribed');assert.equal(d.entries[0].reviewed,true);assert.equal(d.entries[0].status,'hidden');assert.equal(d.settings.voting_open,false);
 const exported=await request('/api/export?type=signups&status=Subscribed',undefined,cookie);assert.equal(exported.status,200);assert.ok(!(await exported.text()).includes('signup@example.com'));
 const pool=new pg.Pool({connectionString:connection.href});
 try{
  await db.query("INSERT INTO signups(email) VALUES('active@example.com'),('ACTIVE@example.com'),('skip@example.com')");
  const c=await saveCampaign(pool,{id:admin},{...defaults,name:'Integration campaign',subject:'Test subject',preheader:'Test',body_text:'Hello subscribers',banner_url:''});
  assert.equal((await campaignList(pool)).audience,2);
  const previousKey=process.env.SENDGRID_API_KEY;process.env.SENDGRID_API_KEY='local-test-only';process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY='test-key';
  await assert.rejects(queueCampaign(pool,{id:admin},{id:c.id,confirmation:'SEND',audience:99}),{status:409});
  await queueCampaign(pool,{id:admin},{id:c.id,confirmation:'SEND',audience:2});
  await assert.rejects(queueCampaign(pool,{id:admin},{id:c.id,confirmation:'SEND',audience:2}),{status:409});
  await assert.rejects(saveCampaign(pool,{id:admin},{...defaults,id:c.id,name:'Modified',subject:'Test',preheader:'',body_text:'Changed'}),{status:409});
  await db.query("INSERT INTO admin_email_suppressions(email,reason) VALUES('skip@example.com','unsubscribe')");
  let calls=0;const fake=async(url,options)=>{calls++;const p=JSON.parse(options.body);assert.equal(p.personalizations[0].to[0].email,'active@example.com');assert.equal(p.personalizations[0].custom_args.upforit_campaign_id,c.id);assert.ok(p.content[1].value.includes(defaults.postal_address));return new Response(null,{status:202,headers:{'x-message-id':'test'}});};
  await Promise.all([deliverOne(pool,'https://example.com',fake),deliverOne(pool,'https://example.com',fake)]);assert.equal(calls,1);
  const recipient=(await db.query("SELECT * FROM admin_email_recipients WHERE email='active@example.com'")).rows[0];
  const event={sg_event_id:'event-1',event:'delivered',timestamp:Math.floor(Date.now()/1000),email:recipient.email,upforit_recipient_id:recipient.id,upforit_campaign_id:c.id};
  await ingestEvents(pool,[event,event,{...event,sg_event_id:'event-2',event:'open'},{...event,sg_event_id:'event-3',event:'open',sg_machine_open:true},{...event,sg_event_id:'wrong',email:'wrong@example.com'}]);
  let report=(await campaignList(pool)).campaigns[0];assert.equal(report.delivered,1);assert.equal(report.opens,1);assert.equal((await db.query('SELECT count(*)::int count FROM admin_email_events')).rows[0].count,3);
  await unsubscribe(pool,recipient.unsubscribe_token);await unsubscribe(pool,recipient.unsubscribe_token);assert.equal((await pool.query(audienceSQL)).rowCount,0);
  assert.equal((await request('/api/campaigns',undefined,cookie)).status,200);
  assert.equal((await request('/api/campaign/save',{},cookie,'https://evil.example.com')).status,403);
  process.env.SENDGRID_API_KEY=previousKey||'';
 }finally{await pool.end();}
 await db.query(`UPDATE users SET role='customer' WHERE id=$1`,[admin]);assert.equal((await request('/api/dashboard',undefined,cookie)).status,401);await db.query(`UPDATE users SET role='admin' WHERE id=$1`,[admin]);
 await db.query("UPDATE user_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[admin]);assert.equal((await request('/api/dashboard',undefined,cookie)).status,401);await db.query("UPDATE user_sessions SET expires_at=now()+interval '1 hour' WHERE user_id=$1",[admin]);
 assert.equal((await request('/api/logout',{},cookie)).status,200);assert.equal((await request('/api/dashboard',undefined,cookie)).status,401);
 console.log('PASS: anonymous access, CSRF, existing password login, non-admin rejection, live reads, persistent subscriber/mix/settings changes, filtered CSV, role revocation, logout, campaign drafts/queue, deduplicated audience, concurrent delivery claims, event attribution/deduplication and unsubscribe persistence.');
}finally{if(server){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}if(db)await db.end();await root.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await root.end();}
