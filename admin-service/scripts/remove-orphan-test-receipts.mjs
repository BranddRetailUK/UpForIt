import {execFileSync} from 'node:child_process';
import pg from 'pg';
const vars=JSON.parse(execFileSync('railway',['variable','list','--project','f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013','--environment','9878dca0-f0ef-4e9c-8d1a-84fe67bef158','--service','95604718-456d-499a-97db-97e7fbe331cd','--json'],{encoding:'utf8',env:{...process.env,RAILWAY_CALLER:'skill:use-railway@1.6.1',RAILWAY_AGENT_SESSION:'upforit-ticket-cleanup-20261012'},stdio:['ignore','pipe','pipe']}));
const db=new pg.Client({connectionString:vars.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:false}});
try{await db.connect();await db.query('BEGIN');
const result=await db.query(`DELETE FROM stripe_event_receipts WHERE event_type='checkout.session.expired' AND created_at<'2026-08-08T00:00:00Z' AND payload#>>'{data,object,metadata,ticketOrderId}'=ANY($1::text[])`,[['9f758d06-0e05-4975-b55f-ec55095852b9','92c46c2f-a9cc-4c95-a3ac-088d16b5a43d','1612690d-4038-4456-b538-ea7d017c5d36']]);
if(result.rowCount!==3)throw Error('Receipt set changed.');
const totals=(await db.query(`SELECT (SELECT count(*) FROM ticket_orders) orders,(SELECT count(*) FROM tickets) tickets,(SELECT count(*) FROM ticket_order_items) items,(SELECT count(*) FROM stripe_event_receipts) webhook_receipts,(SELECT count(*) FROM ticket_audit_log) ticket_audit,(SELECT count(*) FROM email_jobs WHERE job_type='ticket_confirmation') confirmation_jobs,(SELECT count(*) FROM meta_conversion_jobs) conversion_jobs`)).rows[0];
await db.query('COMMIT');console.log('Removed 3 orphaned August test checkout receipts. Final counts:',JSON.stringify(totals));
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
