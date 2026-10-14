import {insertEmailJob} from '../lib/email-jobs';
import {getPool} from '../lib/db';
import {sha256,createTicketQrToken} from '../lib/security';
import {NextRequest} from 'next/server';
import {POST as scan} from '../app/api/admin/check-in/route';
import {Pool,type PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {fulfilPaidOrder} from '../lib/ticket-orders';
import {recordRefund,correlatePaidSession,recordDispute} from '../lib/ticket-payments';
import {reviewAdmissions} from '../lib/ticket-refund-review';
import {resendTickets} from '../lib/ticket-resend';
import {lockTicketTiersForCheckout} from '../lib/ticket-tiers';
async function main(){
 const url=process.env.TICKETING_TEST_DATABASE_URL||'';
 if(!url.startsWith('postgresql://scottcharles@127.0.0.1:55439/'))throw new Error('Disposable local audit database required');
 process.env.DATABASE_URL=url;
 process.env.AUTH_RATE_LIMIT_SECRET='local-test-rate-limit-secret-more-than-32-characters';
 process.env.TICKET_QR_SIGNING_SECRET='local-test-only-qr-secret-more-than-32-characters';
 process.env.EMAIL_JOB_ENCRYPTION_KEY='local-test-only-encryption-key-long-enough';
 const pool=new Pool({connectionString:url});
 async function tx<T>(fn:(db:PoolClient)=>Promise<T>){const db=await pool.connect();try{await db.query('BEGIN');const value=await fn(db);await db.query('COMMIT');return value;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 const user=randomUUID(),event=randomUUID(),tier=randomUUID();
 async function order(){const id=randomUUID(),pi=`pi_${id}`;await pool.query(`INSERT INTO ticket_orders(id,user_id,event_id,subtotal_minor,total_minor,idempotency_key,request_hash,reserved_until) VALUES($1::uuid,$2,$3,3000,3000,$1::text,'test',now()+interval '1 day')`,[id,user,event]);for(const [quantity,price]of [[3,1000],[1,0]])await pool.query(`INSERT INTO ticket_order_items(id,order_id,ticket_type_id,ticket_type_name,unit_price_minor,quantity,line_total_minor) VALUES($1,$2,$3,'Admission',$4,$5,$6)`,[randomUUID(),id,tier,price,quantity,price*quantity]);return{id,pi,session:{id:`cs_${id}`,mode:'payment',payment_status:'paid',payment_intent:pi,amount_total:3000,currency:'gbp',metadata:{ticketOrderId:id},client_reference_id:id}};}
 async function complete(o:Awaited<ReturnType<typeof order>>){return tx(async db=>{const linked=await correlatePaidSession(db,o.session as never);return fulfilPaidOrder(db,linked!.id,linked!.pi);});}
 async function refund(o:Awaited<ReturnType<typeof order>>,amount:number){await tx(db=>recordRefund(db,{id:`ch_${o.id}`,payment_intent:o.pi,amount:3000,amount_refunded:amount,currency:'gbp'} as never));}
 try{
 await pool.query("INSERT INTO users(id,email,display_name,password_hash,role) VALUES($1,$2,'Database Test','unused','admin')",[user,`${user}@example.invalid`]);
 await pool.query("INSERT INTO events(id,slug,title,venue_name,starts_at,ends_at,status,sales_open,merch_discount_enabled) VALUES($1,'nye-2026','NYE Test','Test venue',now()+interval '1 hour',now()+interval '1 day','published',true,true)",[event]);
 await pool.query("INSERT INTO ticket_types(id,event_id,name,price_minor,is_active) VALUES($1,$2,'Admission',1000,true)",[tier,event]);
 const first=await order();const results=await Promise.all([complete(first),complete(first),complete(first)]);assert.equal(results.filter(Boolean).length,1);
 const count=async(id:string,status='true')=>(await pool.query(`SELECT count(*)::int count FROM tickets WHERE order_id=$1 AND ${status}`,[id])).rows[0].count;
 assert.equal(await count(first.id),4);await refund(first,1000);await complete(first);assert.equal(await count(first.id),4);
 const tickets=(await pool.query('SELECT id FROM tickets WHERE order_id=$1 ORDER BY id',[first.id])).rows.map(r=>r.id);
 await assert.rejects(tx(db=>reviewAdmissions(db,first.id,user,tickets,1000)));
 await tx(db=>reviewAdmissions(db,first.id,user,tickets.slice(0,2),1000));assert.equal(await count(first.id,"status='valid'"),2);
 const resends=await Promise.allSettled([tx(db=>resendTickets(db,first.id,user,true)),tx(db=>resendTickets(db,first.id,user,true))]);assert.equal(resends.filter(r=>r.status==='fulfilled').length,1);
 await refund(first,3000);assert.equal(await count(first.id,"status<>'void'"),0);
 const second=await order();await refund(second,1000);assert.equal((await complete(second))?.admissionsHold,true);
 await tx(db=>recordDispute(db,{id:`dp_${second.id}`,payment_intent:second.pi,status:'needs_response'} as never,100));await assert.rejects(tx(db=>reviewAdmissions(db,second.id,user,[],1000)));
 await tx(db=>recordDispute(db,{id:`dp_${second.id}`,payment_intent:second.pi,status:'won'} as never,200));assert.equal((await pool.query('SELECT admissions_hold FROM ticket_orders WHERE id=$1',[second.id])).rows[0].admissions_hold,true);
 const third=await order();await complete(third);
 const token=randomUUID();await pool.query("INSERT INTO user_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",[randomUUID(),user,sha256(token)]);
 const ticket=(await pool.query('SELECT public_id FROM tickets WHERE order_id=$1 LIMIT 1',[third.id])).rows[0];
 const request=(eventId:string)=>new NextRequest('http://localhost:3000/api/admin/check-in',{method:'POST',headers:{origin:'http://localhost:3000',cookie:`upforit_session=${token}`,'content-type':'application/json'},body:JSON.stringify({eventId,code:createTicketQrToken(ticket.public_id)})});
 assert.equal((await scan(request(randomUUID()))).status,404);
 const scans=await Promise.all([scan(request(event)),scan(request(event))]);assert.deepEqual(scans.map(r=>r.status).sort(),[200,409]);
 await refund(third,3000);assert.equal((await scan(request(event))).status,404);
 if(process.env.TICKET_EMAIL_TEST_RECIPIENT){
   await pool.query("UPDATE email_jobs SET status='cancelled' WHERE status IN ('pending','failed')");
   const mail=await order();await complete(mail);
   await tx(db=>insertEmailJob(db,'ticket_confirmation',{to:process.env.TICKET_EMAIL_TEST_RECIPIENT,displayName:'Ticket delivery test — not valid for admission',orderId:mail.id},{userId:user,orderId:mail.id}));
   console.log('Test email queued for order',mail.id);
 }
 await tx(db=>lockTicketTiersForCheckout(db,[{ticketTypeId:tier,quantity:10}]));await pool.query('UPDATE ticket_types SET is_active=false WHERE id=$1',[tier]);await assert.rejects(tx(db=>lockTicketTiersForCheckout(db,[{ticketTypeId:tier,quantity:1}])));
 console.log('PASS: concurrent fulfilment; duplicate completion after refund; admission review pricing; concurrent resend; full refund; refund before completion; dispute hold; unlimited capacity; inactive tier.');
 }finally{await pool.query("UPDATE events SET slug=$2 WHERE id=$1",[event,`audit-${event}`]);await pool.end();await getPool().end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
