// One-off, tightly scoped cleanup authorised by the owner on 12 October 2026.
// No Stripe API calls, refunds, account deletion, or event configuration changes.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
const vars=JSON.parse(execFileSync('railway',['variable','list','--project','f2b0b5dd-cc1f-4b80-b7bd-c0f3939ae013','--environment','9878dca0-f0ef-4e9c-8d1a-84fe67bef158','--service','95604718-456d-499a-97db-97e7fbe331cd','--json'],{encoding:'utf8',env:{...process.env,RAILWAY_CALLER:'skill:use-railway@1.6.1',RAILWAY_AGENT_SESSION:'upforit-ticket-cleanup-20261012'},stdio:['ignore','pipe','pipe']}));
const db=new pg.Client({connectionString:vars.DATABASE_PUBLIC_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
const event='4e37f654-31f8-4c86-a59e-bf4e72c7f0a1';
try{
 await db.connect();await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");await db.query("SET LOCAL statement_timeout='20s'");
 const orders=(await db.query('SELECT id,order_number,status,created_at FROM ticket_orders WHERE event_id=$1 FOR UPDATE',[event])).rows;
 assert.equal(orders.length,11,'Order set has changed; refuse cleanup.');
 assert.deepEqual(orders.filter(o=>o.status==='paid').map(o=>o.order_number).sort(),['UFI-001001','UFI-001002','UFI-001007','UFI-001008']);
 assert.equal(orders.filter(o=>o.status==='expired').length,7);
 assert.ok(orders.every(o=>o.created_at<new Date('2026-09-27T00:00:00Z')));
 const ids=orders.map(o=>o.id);
 const protectedCounts=async()=> (await db.query(`SELECT (SELECT count(*) FROM users) users,(SELECT count(*) FROM signups) signups,(SELECT count(*) FROM mix_entries) mixes,(SELECT count(*) FROM events) events,(SELECT count(*) FROM ticket_types) tiers`)).rows[0];
 const before=await protectedCounts();
 const busy=await db.query(`SELECT id FROM email_jobs WHERE order_id=ANY($1::uuid[]) AND status='processing' UNION ALL SELECT id FROM meta_conversion_jobs WHERE order_id=ANY($1::uuid[]) AND status='processing'`,[ids]);assert.equal(busy.rowCount,0,'A purchase job is processing; refuse cleanup.');
 const redeemed=await db.query(`SELECT id FROM merch_discount_entitlements WHERE source_ticket_order_id=ANY($1::uuid[]) AND status IN ('redeemed','reserved')`,[ids]);assert.equal(redeemed.rowCount,0,'A related merch discount is in use; refuse cleanup.');
 const receipts=`SELECT r.stripe_event_id FROM stripe_event_receipts r WHERE EXISTS (SELECT 1 FROM ticket_orders o WHERE o.id=ANY($1::uuid[]) AND (
 r.payload#>>'{data,object,metadata,ticketOrderId}'=o.id::text OR r.payload#>>'{data,object,client_reference_id}'=o.id::text OR
 r.payload#>>'{data,object,id}' IN (o.stripe_checkout_session_id,o.stripe_payment_intent_id,o.stripe_charge_id) OR
 r.payload#>>'{data,object,payment_intent}'=o.stripe_payment_intent_id OR r.payload#>>'{data,object,charge}'=o.stripe_charge_id))`;
 const receiptIds=(await db.query(receipts,[ids])).rows.map(r=>r.stripe_event_id);
 const counts={};
 const remove=async(name,sql,params=[ids])=>{counts[name]=(await db.query(sql,params)).rowCount;};
 await remove('ticket_audit_log','DELETE FROM ticket_audit_log WHERE order_id=ANY($1::uuid[]) OR ticket_id IN (SELECT id FROM tickets WHERE order_id=ANY($1::uuid[]))');
 await remove('email_jobs','DELETE FROM email_jobs WHERE order_id=ANY($1::uuid[])');
 await remove('meta_conversion_jobs','DELETE FROM meta_conversion_jobs WHERE order_id=ANY($1::uuid[])');
 await remove('merch_discount_sync_jobs','DELETE FROM merch_discount_sync_jobs WHERE entitlement_id IN (SELECT id FROM merch_discount_entitlements WHERE source_ticket_order_id=ANY($1::uuid[]))');
 await remove('merch_discount_entitlements','DELETE FROM merch_discount_entitlements WHERE source_ticket_order_id=ANY($1::uuid[])');
 await remove('stripe_event_receipts','DELETE FROM stripe_event_receipts WHERE stripe_event_id=ANY($1::text[])',[receiptIds]);
 await remove('admin_order_audit','DELETE FROM admin_audit_log WHERE subject_id=ANY($1::text[])',[ids]);
 await remove('tickets','DELETE FROM tickets WHERE order_id=ANY($1::uuid[])');
 await remove('ticket_order_items','DELETE FROM ticket_order_items WHERE order_id=ANY($1::uuid[])');
 await remove('ticket_orders','DELETE FROM ticket_orders WHERE id=ANY($1::uuid[])');
 assert.equal(counts.tickets,4);assert.equal(counts.ticket_orders,11);assert.equal(counts.ticket_order_items,11);
 assert.deepEqual(await protectedCounts(),before,'Protected records changed');
 const remaining=(await db.query(`SELECT (SELECT count(*) FROM ticket_orders) orders,(SELECT count(*) FROM tickets) tickets,(SELECT COALESCE(sum(total_minor),0) FROM ticket_orders WHERE status='paid') revenue_minor,(SELECT count(*) FROM stripe_event_receipts) stripe_receipts`)).rows[0];
 assert.equal(Number(remaining.orders),0);assert.equal(Number(remaining.tickets),0);assert.equal(Number(remaining.revenue_minor),0);
 if(!process.argv.includes('--apply')){await db.query('ROLLBACK');console.log('DRY RUN: rolled back',JSON.stringify({wouldRemove:counts,remaining,protectedRecordsUnchanged:true}));}
 else {await db.query('COMMIT');console.log('COMMITTED',JSON.stringify({removed:counts,remaining,protectedRecordsUnchanged:true}));}
}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{await db.end();}
