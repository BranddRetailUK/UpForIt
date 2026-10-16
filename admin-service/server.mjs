import {adminBucketData,administerBucket} from './bucket.mjs';
import {ingestTicketEmailEvents} from './ticket-email-events.mjs';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import {hash,sessionToken,sameOrigin,sessionCookie,csvCell,httpError} from './security.mjs';
import {dashboard,mutate,audit,subscriberSql,entrySql,competitionId} from './data.mjs';
import {metaAnalytics} from './meta.mjs';
import {trafficAnalytics} from './traffic.mjs';
import {campaignList,campaignDetail,saveCampaign,queueCampaign,verifyWebhook,ingestEvents,unsubscribe,startCampaignWorker,emailHTML} from './campaigns.mjs';
const production=process.env.NODE_ENV==='production';
const port=Number(process.env.PORT||4310),root=fileURLToPath(new URL('./public',import.meta.url));
const origin=process.env.ADMIN_ORIGIN||(process.env.RAILWAY_PUBLIC_DOMAIN?`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`:`http://localhost:${port}`);
if(!process.env.DATABASE_URL||!process.env.AUTH_RATE_LIMIT_SECRET)throw new Error('DATABASE_URL and AUTH_RATE_LIMIT_SECRET are required.');
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:15000,...(process.env.DB_SSL==='true'?{ssl:{rejectUnauthorized:false}}:{})});
db.on('error',()=>console.error('Database connection error'));
const client=await db.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(739128461)');await client.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.woff2':'font/woff2'};
const dummy='$2b$12$lQAEeVgLq1f7nNcxz6A19u/wCgh4hfTi2qvYozqzDAt2JplQyhj5G';
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw httpError(415,'JSON required.');let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>65536)throw httpError(413,'Request too large.');chunks.push(chunk);}try{const v=JSON.parse(Buffer.concat(chunks).toString());if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v;}catch{throw httpError(400,'Invalid JSON.');}}
async function rate(key,limit){const r=await db.query(`INSERT INTO auth_rate_limits(bucket_key,attempt_count,window_started_at) VALUES($1,1,now()) ON CONFLICT(bucket_key) DO UPDATE SET attempt_count=CASE WHEN auth_rate_limits.window_started_at<now()-interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempt_count+1 END,window_started_at=CASE WHEN auth_rate_limits.window_started_at<now()-interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END RETURNING attempt_count`,[hash(process.env.AUTH_RATE_LIMIT_SECRET+':admin:'+key)]);return r.rows[0].attempt_count<=limit;}
async function admin(req){const token=sessionToken(req);if(!token)throw httpError(401,'Please sign in.');const r=await db.query(`SELECT u.id,u.email,u.display_name FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL AND u.role='admin'`,[hash(token)]);if(!r.rows[0])throw httpError(401,'Please sign in with an admin account.');return r.rows[0];}
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('X-Robots-Tag','noindex, nofollow');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src https://res.cloudinary.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
 try{
 const url=new URL(req.url,origin),p=url.pathname;
 if(p==='/health'&&req.method==='GET'){await db.query('SELECT 1');return json(res,200,{ok:true});}
 if(p==='/webhooks/sendgrid'&&req.method==='POST'){
  let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>2097152)throw httpError(413,'Event batch too large.');chunks.push(chunk);}
  const raw=Buffer.concat(chunks);verifyWebhook(raw,req.headers);let events;try{events=JSON.parse(raw.toString());}catch{throw httpError(400,'Invalid JSON.');}
  await ingestEvents(db,events);await ingestTicketEmailEvents(db,events);return json(res,200,{ok:true});
 }
 if(p==='/email/unsubscribe'){
  const token=url.searchParams.get('token');if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))throw httpError(404,'Link not found.');
  if(req.method==='POST'){await unsubscribe(db,token);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<h1>You have been unsubscribed from UPFORIT marketing emails.</h1>');}
  if(req.method!=='GET')throw httpError(405,'Method not allowed.');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><h1>Unsubscribe from UPFORIT emails?</h1><form method="post"><button type="submit">Unsubscribe</button></form>');
 }
 if(p.startsWith('/api/')){
  if(!['GET','POST'].includes(req.method))throw httpError(405,'Method not allowed.');
  if(req.method==='POST'&&!sameOrigin(req,origin))throw httpError(403,'Invalid request origin.');
  if(p==='/api/login'&&req.method==='POST'){
   const b=await body(req),email=typeof b.email==='string'?b.email.trim().toLowerCase():'',password=typeof b.password==='string'?b.password:'';
   if(email.length>254||Buffer.byteLength(password)>72||!email||!password)throw httpError(400,'Enter your email and password.');
   const ip=(req.headers['x-real-ip']||req.headers['x-forwarded-for']?.split(',')[0]||req.socket.remoteAddress||'unknown').slice(0,100);
   const limits=await Promise.all([rate('login-ip:'+ip,50),rate('login-email:'+email,10)]);if(limits.includes(false)){res.setHeader('Retry-After','900');throw httpError(429,'Too many attempts. Try again in 15 minutes.');}
   const user=(await db.query('SELECT id,password_hash,role,email_verified_at,disabled_at FROM users WHERE lower(email)=$1',[email])).rows[0];
   const matches=await bcrypt.compare(password,user?.password_hash||dummy);
   if(!user||!matches||user.disabled_at||!user.email_verified_at||user.role!=='admin')throw httpError(401,'Email or password is incorrect, or this account does not have admin access.');
   const previous=sessionToken(req);if(previous)await db.query('DELETE FROM user_sessions WHERE token_hash=$1',[hash(previous)]);
   const token=randomBytes(32).toString('base64url');await db.query(`INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')`,[randomUUID(),user.id,hash(token)]);
   await audit(db,user,'Admin signed in',user.id);res.setHeader('Set-Cookie',sessionCookie(token,43200,production));return json(res,200,{ok:true});
  }
  // Every data read, export and mutation rechecks the live user role and session.
  const user=await admin(req);
  if(p==='/api/session'&&req.method==='GET')return json(res,200,{user,storefront:process.env.STOREFRONT_URL||'https://www.upforitevents.co.uk'});
  if(p==='/api/logout'&&req.method==='POST'){await db.query('DELETE FROM user_sessions WHERE token_hash=$1',[hash(sessionToken(req))]);res.setHeader('Set-Cookie',sessionCookie('',0,production));return json(res,200,{ok:true});}
  if(p==='/api/bucket'&&req.method==='GET'){
   const data=await adminBucketData(db);
   if(url.searchParams.get('export')==='csv'){
    const cols=['dj_name','email','status','eligible','checked_in','created_at'];
    await audit(db,user,'Bucket CSV exported','nye-2026',{count:data.entries.length});
    res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="blackleys-bucket.csv"'});
    return res.end([cols.join(','),...data.entries.map(row=>cols.map(k=>csvCell(row[k] instanceof Date?row[k].toISOString():row[k])).join(','))].join('\r\n'));
   }
   return json(res,200,data);
  }
  if(p==='/api/bucket'&&req.method==='POST'){
   if(!await rate('bucket:'+user.id,120))throw httpError(429,'Too many draw updates. Please wait.');
   const b=await body(req);
   if(!['draw','played','skipped'].includes(b.action)||(b.action!=='draw'&&typeof b.entryId!=='string'))throw httpError(400,'Choose a valid draw action.');
   await administerBucket(db,user.id,b.action,b.entryId);
   return json(res,200,await adminBucketData(db));
  }
  if(p==='/api/dashboard'&&req.method==='GET')return json(res,200,await dashboard(db));
  if(p==='/api/campaigns'&&req.method==='GET')return json(res,200,await campaignList(db));
  if(p==='/api/campaign'&&req.method==='GET')return json(res,200,await campaignDetail(db,url.searchParams.get('id')));
  if(p==='/api/campaign/preview'&&req.method==='GET'){
   const detail=await campaignDetail(db,url.searchParams.get('id'));res.setHeader('Content-Security-Policy',"default-src 'none'; img-src https:; style-src 'unsafe-inline'; sandbox");res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(emailHTML(detail.campaign,'#preview-unsubscribe'));
  }
  if(['/api/campaign/save','/api/campaign/send'].includes(p)&&req.method==='POST'){
   if(!await rate('campaign:'+user.id,60))throw httpError(429,'Too many campaign updates.');
   return json(res,200,await(p.endsWith('/save')?saveCampaign:queueCampaign)(db,user,await body(req)));
  }
  if(p==='/api/analytics' &&req.method==='GET')return json(res,200,await metaAnalytics());
  if(p==='/api/traffic'&&req.method==='GET'){
   const days=Number(url.searchParams.get('days')||7);
   if(![1,7,30].includes(days))throw httpError(400,'Choose 1, 7 or 30 days.');
   return json(res,200,await trafficAnalytics(days));
  }
  if(p==='/api/export'&&req.method==='GET'){
   const type=url.searchParams.get('type');if(!['signups','mixes'].includes(type))throw httpError(400,'Invalid export.');
   const result=type==='signups'?await db.query(subscriberSql+' ORDER BY s.created_at DESC'):await db.query(entrySql+' ORDER BY e.created_at DESC',[competitionId]);
   const search=(url.searchParams.get('search')||'').toLowerCase(),status=url.searchParams.get('status')||'All',genre=url.searchParams.get('genre')||'All genres';
   const rows=result.rows.filter(r=>(status==='All'||(status==='Needs review'?!r.reviewed:r.status.toLowerCase()===status.toLowerCase()))&&(genre==='All genres'||r.genre===genre)&&[r.email,r.artist,r.title].filter(Boolean).join(' ').toLowerCase().includes(search));
   const cols=type==='signups'?['email','status','created_at']:['artist','title','genre','email','source','status','reviewed','votes','created_at'];
   await audit(db,user,'CSV exported',type,{count:rows.length,status});res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="upforit-${type}.csv"`});res.end([cols.join(','),...rows.map(r=>cols.map(c=>csvCell(r[c] instanceof Date?r[c].toISOString():r[c])).join(','))].join('\r\n'));return;
  }
  if(req.method==='POST'&&['/api/subscriber','/api/entry','/api/settings','/api/resend'].includes(p)){if(!await rate('mutation:'+user.id,300))throw httpError(429,'Too many updates. Please wait.');return json(res,200,await mutate(db,user,p,await body(req)));}
  throw httpError(404,'Not found.');
 }
 if(!['GET','HEAD'].includes(req.method))throw httpError(405,'Method not allowed.');
 const file=path.resolve(root,'.'+decodeURIComponent(p==='/'?'/index.html':p));if(!file.startsWith(root+path.sep))throw httpError(404,'Not found.');
 const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);
 }catch(e){const status=e.status||(e.code==='ENOENT'?404:500);if(status===500)console.error('Admin request failed',{code:e.code||e.name,...(!production?{message:e.message,position:e.position}:{})});if(!res.headersSent)json(res,status,{error:status===500?'Unable to complete the request. Please try again.':e.message});else res.end();}
});
server.requestTimeout=20000;server.headersTimeout=15000;
server.listen(port,production?'0.0.0.0':'127.0.0.1',()=>console.log(`UPFORIT admin listening on port ${port}`));
const stopCampaignWorker=startCampaignWorker(db,origin);
process.on('SIGTERM',()=>{stopCampaignWorker();server.close(()=>db.end().finally(()=>process.exit(0)));});
