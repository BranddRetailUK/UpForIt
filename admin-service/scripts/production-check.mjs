import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {dashboard} from '../data.mjs';
const project='f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013',environment='9878dca0-f0ef-4e9c-8d1a-84fe67bef158';
const vars=JSON.parse(execFileSync('railway',['variable','list','--project',project,'--environment',environment,'--service','95604718-456d-499a-97db-97e7fbe331cd','--json'],{encoding:'utf8',env:{...process.env,RAILWAY_CALLER:'skill:use-railway@1.6.1',RAILWAY_AGENT_SESSION:'upforit-admin-20261012'},stdio:['ignore','pipe','pipe']}));
const db=new pg.Client({connectionString:vars.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
try{await db.connect();await db.query('BEGIN READ ONLY');
 const tables=['users','user_sessions','auth_rate_limits','signups','mix_entries','mix_competitions','mix_votes','mix_admin_audit','ticket_orders','tickets','ticket_types','ticket_audit_log','email_jobs'];
 for(const t of tables){const r=await db.query('SELECT to_regclass($1) present',[t]);if(!r.rows[0].present)throw Error('Missing table: '+t);}
 const admins=await db.query("SELECT count(*)::int count FROM users WHERE role='admin' AND email_verified_at IS NOT NULL AND disabled_at IS NULL");
 const required=await db.query("SELECT count(*)::int count FROM information_schema.columns WHERE table_name='ticket_types' AND column_name='archived_at'");if(!required.rows[0].count)throw Error('Missing ticket migration');
 console.log('Production schema verified. Eligible existing admins:',admins.rows[0].count);
 const ready=await db.query("SELECT to_regclass('admin_audit_log') present");
 if(ready.rows[0].present){const live=await dashboard(db);console.log('Live dashboard queries verified:',JSON.stringify({signups:live.subscribers.length,mixEntries:live.entries.length,orders:live.orders.length,ticketTiers:live.tiers.length,competitionConfigured:Boolean(live.settings)}));}
 await db.query('ROLLBACK');}finally{await db.end();}
