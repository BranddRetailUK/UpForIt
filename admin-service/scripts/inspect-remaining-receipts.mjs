import {execFileSync} from 'node:child_process';
import pg from 'pg';
const vars=JSON.parse(execFileSync('railway',['variable','list','--project','f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013','--environment','9878dca0-f0ef-4e9c-8d1a-84fe67bef158','--service','95604718-456d-499a-97db-97e7fbe331cd','--json'],{encoding:'utf8',env:{...process.env,RAILWAY_CALLER:'skill:use-railway@1.6.1',RAILWAY_AGENT_SESSION:'upforit-ticket-cleanup-20261012'},stdio:['ignore','pipe','pipe']}));
const db=new pg.Client({connectionString:vars.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:false}});
try{await db.connect();await db.query('BEGIN READ ONLY');
console.log(JSON.stringify((await db.query("SELECT event_type,livemode,created_at,processed_at,error_message, payload#>>'{data,object,metadata,ticketOrderId}' order_reference,payload#>>'{data,object,metadata,eventId}' event_reference FROM stripe_event_receipts ORDER BY created_at")).rows));
await db.query('ROLLBACK');}finally{await db.end();}
