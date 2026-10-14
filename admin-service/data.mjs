import {randomUUID} from 'node:crypto';
import {encryptJson,httpError,validateEntry,validateSettings} from './security.mjs';
export const competitionId='nye-2026';
export const subscriberSql=`SELECT s.id,s.email,s.created_at,CASE WHEN EXISTS(SELECT 1 FROM admin_email_suppressions x WHERE x.email=lower(trim(s.email))) THEN 'Unsubscribed' ELSE COALESCE(p.status,'Subscribed') END status FROM signups s LEFT JOIN admin_signup_preferences p ON p.signup_id=s.id`;
export const entrySql=`SELECT e.id,e.artist,e.title,e.genre,e.email,e.source,e.source_url,e.audio_url,e.allow_download,e.status,e.created_at,COALESCE(r.reviewed,false) reviewed,
 (SELECT count(*)::int FROM mix_votes v JOIN users u ON u.id=v.user_id WHERE v.entry_id=e.id AND v.invalidated_at IS NULL AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL) votes
 FROM mix_entries e LEFT JOIN admin_mix_reviews r ON r.entry_id=e.id WHERE e.competition_id=$1`;
export async function dashboard(db){
 const [subs,entries,settings,orders,tiers,metrics,event,growth,audit]=await Promise.all([
 db.query(subscriberSql+' ORDER BY s.created_at DESC'),db.query(entrySql+' ORDER BY e.created_at DESC',[competitionId]),
 db.query('SELECT * FROM mix_competitions WHERE id=$1',[competitionId]),
 db.query(`SELECT o.id,o.order_number,o.status,o.total_minor,o.refunded_minor,o.admissions_hold,o.currency,o.created_at,o.confirmation_email_sent_at,u.display_name,u.email,e.title event_title,
 (SELECT count(*)::int FROM tickets t WHERE t.order_id=o.id) ticket_count,
 (SELECT status FROM email_jobs WHERE order_id=o.id AND job_type='ticket_confirmation' ORDER BY created_at DESC LIMIT 1) email_status,
 (SELECT COALESCE(sum(quantity),0)::int FROM ticket_order_items WHERE order_id=o.id AND unit_price_minor=0) free_count,
 (SELECT count(*)::int FROM tickets t WHERE t.order_id=o.id AND t.status='checked_in') checked_in,
 EXISTS(SELECT 1 FROM ticket_audit_log a WHERE a.order_id=o.id AND a.action='admin_simulated_purchase') simulated
 FROM ticket_orders o JOIN users u ON u.id=o.user_id JOIN events e ON e.id=o.event_id WHERE o.status<>'expired' ORDER BY o.created_at DESC LIMIT 500`),
 db.query(`SELECT tt.id,tt.name,tt.price_minor,tt.currency,tt.capacity,tt.is_active,e.sales_open,e.title event_title,
 COALESCE((SELECT sum(i.quantity)::int FROM ticket_order_items i JOIN ticket_orders o ON o.id=i.order_id WHERE i.ticket_type_id=tt.id AND o.status='paid'),0) sold
 FROM ticket_types tt JOIN events e ON e.id=tt.event_id WHERE tt.archived_at IS NULL ORDER BY e.starts_at,tt.sort_order`),
 db.query(`SELECT (SELECT count(*)::int FROM ticket_orders WHERE status='paid') paid_orders,
 (SELECT COALESCE(sum(total_minor-refunded_minor),0) FROM ticket_orders WHERE paid_at IS NOT NULL) revenue_minor,
 (SELECT count(*)::int FROM tickets WHERE status<>'void') issued_tickets,
 (SELECT count(*)::int FROM tickets WHERE status='checked_in') checked_in,
 (SELECT count(*)::int FROM ticket_orders WHERE status<>'expired') order_count`),
 db.query(`SELECT id,title,starts_at,venue_name,slug FROM events WHERE status='published' AND ends_at>now() ORDER BY starts_at LIMIT 1`),
 db.query(`SELECT to_char(series_day,'YYYY-MM-DD') AS day,count(s.id)::int count FROM generate_series((now() AT TIME ZONE 'Europe/London')::date-29,(now() AT TIME ZONE 'Europe/London')::date,interval '1 day') AS series_day LEFT JOIN signups s ON (s.created_at AT TIME ZONE 'Europe/London')::date=series_day::date GROUP BY series_day ORDER BY series_day`),
 db.query(`SELECT a.action,a.created_at,u.display_name actor FROM admin_audit_log a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 8`)
 ]);
 return {subscribers:subs.rows,entries:entries.rows,settings:settings.rows[0]||null,orders:orders.rows,tiers:tiers.rows,metrics:metrics.rows[0],event:event.rows[0]||null,growth:growth.rows,activity:audit.rows};
}
export async function audit(db,user,action,subject,details={}){await db.query('INSERT INTO admin_audit_log(id,actor_id,action,subject_id,details) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user.id,action,String(subject||''),JSON.stringify(details)]);}
export async function mutate(pool,user,path,b){
 const db=await pool.connect();try{await db.query('BEGIN');
 if(path==='/api/subscriber'){
  if(!Number.isSafeInteger(b.id)||!['Subscribed','Unsubscribed'].includes(b.status))throw httpError(400,'Invalid subscription.');
  const s=await db.query('SELECT id FROM signups WHERE id=$1 FOR UPDATE',[b.id]);if(!s.rowCount)throw httpError(404,'Subscriber not found.');
  await db.query(`INSERT INTO admin_signup_preferences(signup_id,status,updated_by) VALUES($1,$2,$3) ON CONFLICT(signup_id) DO UPDATE SET status=$2,updated_by=$3,updated_at=now()`,[b.id,b.status,user.id]);
  if(b.status==='Subscribed'&&(await db.query('SELECT 1 FROM admin_email_suppressions WHERE email=(SELECT lower(trim(email)) FROM signups WHERE id=$1)',[b.id])).rowCount)throw httpError(409,'This address is suppressed after an unsubscribe, complaint or bounce. Obtain renewed consent and review before restoring it.');
  await audit(db,user,'Subscription updated',b.id,{status:b.status});
 }else if(path==='/api/entry'){
  validateEntry(b);const old=(await db.query('SELECT * FROM mix_entries WHERE id=$1 AND competition_id=$2 FOR UPDATE',[b.id,competitionId])).rows[0];if(!old)throw httpError(404,'Entry not found.');
  await db.query(`UPDATE mix_entries SET artist=$2,title=$3,email=$4,genre=$5,status=$6,allow_download=$7,updated_at=now() WHERE id=$1`,[b.id,b.artist.trim(),b.title.trim(),b.email.trim().toLowerCase(),b.genre,b.status,old.source==='Upload'&&b.allow_download]);
  await db.query(`INSERT INTO admin_mix_reviews(entry_id,reviewed,updated_by) VALUES($1,$2,$3) ON CONFLICT(entry_id) DO UPDATE SET reviewed=$2,updated_by=$3,updated_at=now()`,[b.id,b.reviewed,user.id]);
  await db.query('INSERT INTO mix_admin_audit(id,actor_id,action,entry_id,details) VALUES($1,$2,$3,$4,$5)',[randomUUID(),user.id,'entry',b.id,JSON.stringify({before:{artist:old.artist,title:old.title,status:old.status,allow_download:old.allow_download},after:b})]);
  await audit(db,user,'Mix entry updated',b.id,{artist:b.artist,status:b.status,reviewed:b.reviewed});
 }else if(path==='/api/settings'){
  const dates=validateSettings(b);const result=await db.query(`UPDATE mix_competitions SET submissions_open=$2,voting_open=$3,submissions_close_at=$4,voting_close_at=$5,announce_at=$6,updated_at=now() WHERE id=$1`,[competitionId,b.submissions,b.voting,...dates]);if(!result.rowCount)throw httpError(404,'Competition not found.');
  await db.query('INSERT INTO mix_admin_audit(id,actor_id,action,details) VALUES($1,$2,$3,$4)',[randomUUID(),user.id,'settings',JSON.stringify(b)]);await audit(db,user,'Competition settings updated',competitionId,b);
 }else if(path==='/api/resend'){
  const order=(await db.query(`SELECT o.user_id,o.id,u.email,u.display_name FROM ticket_orders o JOIN users u ON u.id=o.user_id WHERE o.id=$1 AND o.status IN ('paid','refund_review') AND o.admissions_hold=false FOR UPDATE OF o`,[b.id])).rows[0];if(!order)throw httpError(404,'Paid order not found.');
  const recent=await db.query(`SELECT id FROM email_jobs WHERE order_id=$1 AND job_type='ticket_confirmation' AND (created_at>now()-interval '2 minutes' OR status IN ('pending','processing'))`,[b.id]);if(recent.rowCount)throw httpError(429,'A confirmation was recently queued. Please wait two minutes.');
  await db.query(`INSERT INTO email_jobs(id,job_type,user_id,order_id,encrypted_payload) VALUES($1,'ticket_confirmation',$2,$3,$4)`,[randomUUID(),order.user_id,order.id,encryptJson({to:order.email,displayName:order.display_name,orderId:order.id})]);await audit(db,user,'Ticket confirmation queued',order.id);
 }else throw httpError(404,'Not found.');
 await db.query('COMMIT');return {ok:true};
 }catch(e){await db.query('ROLLBACK');if(e.code==='22P02')throw httpError(400,'Invalid record identifier.');throw e;}finally{db.release();}
}
