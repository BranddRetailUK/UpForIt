import {httpError} from './security.mjs';
const fields=`u.id,u.display_name,u.email,u.role,u.created_at,u.updated_at,u.email_verified_at,u.disabled_at,
 CASE WHEN EXISTS(SELECT 1 FROM admin_email_suppressions x WHERE x.email=lower(trim(u.email))) THEN 'Unsubscribed'
 WHEN EXISTS(SELECT 1 FROM signups s LEFT JOIN admin_signup_preferences p ON p.signup_id=s.id WHERE lower(trim(s.email))=lower(trim(u.email)) AND COALESCE(p.status,'Subscribed')='Subscribed') THEN 'Subscribed'
 WHEN EXISTS(SELECT 1 FROM signups s WHERE lower(trim(s.email))=lower(trim(u.email))) THEN 'Unsubscribed' ELSE 'Not subscribed' END newsletter,
 (SELECT count(*)::int FROM ticket_orders o WHERE o.user_id=u.id AND o.paid_at IS NOT NULL) paid_orders,
 (SELECT COALESCE(sum(o.total_minor-o.refunded_minor),0) FROM ticket_orders o WHERE o.user_id=u.id AND o.paid_at IS NOT NULL) net_spend_minor,
 (SELECT COALESCE(sum(o.refunded_minor),0) FROM ticket_orders o WHERE o.user_id=u.id AND o.paid_at IS NOT NULL) refunded_minor,
 (SELECT max(o.paid_at) FROM ticket_orders o WHERE o.user_id=u.id) last_purchase_at,
 (SELECT count(*)::int FROM tickets t JOIN ticket_orders o ON o.id=t.order_id WHERE o.user_id=u.id AND t.status<>'void') tickets,
 (SELECT count(*)::int FROM tickets t JOIN ticket_orders o ON o.id=t.order_id WHERE o.user_id=u.id AND t.status='checked_in') checked_in`;
export async function accountList(db,params){
 const q=(params.get('q')||'').trim().slice(0,200),page=Math.max(0,Math.min(100000,Number.parseInt(params.get('page')||'0',10)||0));
 const where="($1='' OR u.display_name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%')";
 const total=(await db.query('SELECT count(*)::int total FROM users u WHERE '+where,[q])).rows[0].total;
 const rows=(await db.query(`SELECT ${fields} FROM users u WHERE ${where} ORDER BY u.created_at DESC,u.id DESC LIMIT 50 OFFSET $2`,[q,page*50])).rows;
 return {rows,total,page,pageSize:50};
}
export async function accountDetail(db,id){
 if(!/^[0-9a-f-]{36}$/i.test(id||''))throw httpError(400,'Invalid account.');
 const account=(await db.query(`SELECT ${fields} FROM users u WHERE u.id=$1`,[id])).rows[0];
 if(!account)throw httpError(404,'Account not found.');
 const orders=(await db.query(`SELECT o.id,o.order_number,o.status,o.created_at,o.paid_at,o.currency,o.total_minor,o.refunded_minor,e.title event_title,
 (SELECT count(*)::int FROM tickets t WHERE t.order_id=o.id) ticket_count,
 (SELECT status FROM email_jobs j WHERE j.order_id=o.id AND j.job_type='ticket_confirmation' ORDER BY j.created_at DESC LIMIT 1) email_status
 FROM ticket_orders o JOIN events e ON e.id=o.event_id WHERE o.user_id=$1 AND o.paid_at IS NOT NULL ORDER BY o.paid_at DESC LIMIT 100`,[id])).rows;
 return {account,orders};
}
