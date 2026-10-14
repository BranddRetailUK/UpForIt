import {getPool} from '../lib/db';
import {TICKET_LAUNCH_APPROVED} from '../lib/ticket-launch';
async function main(){
 const failures:string[]=[];
 for(const key of ['DATABASE_URL','STRIPE_SECRET_KEY','STRIPE_TICKETS_WEBHOOK_SECRET','TICKET_QR_SIGNING_SECRET','EMAIL_JOB_ENCRYPTION_KEY','AUTH_RATE_LIMIT_SECRET','NEXT_PUBLIC_SITE_URL','SENDGRID_TICKET_EVENT_PUBLIC_KEY'])if(!process.env[key])failures.push(`Missing ${key}`);
 if(process.env.APP_ENV==='production'&&process.env.EMAIL_FORCE_RECIPIENT?.trim())failures.push('Production EMAIL_FORCE_RECIPIENT must be empty');
 if(!TICKET_LAUNCH_APPROVED)failures.push('Launch approval lock is closed (expected before launch)');
 if(process.env.DATABASE_URL){
  const db=getPool();
  try{
   const result=await db.query(`SELECT e.ends_at,e.merch_discount_enabled,tt.price_minor,tt.currency,tt.capacity,tt.max_per_order,tt.sales_end_at FROM events e JOIN ticket_types tt ON tt.event_id=e.id WHERE e.slug='nye-2026' AND tt.archived_at IS NULL AND tt.is_active=true`);
   const t=result.rows[0];
   if(result.rowCount!==1||!t||t.price_minor!==1000||t.currency!=='gbp'||t.capacity!==null||t.max_per_order!==10||!t.merch_discount_enabled||new Date(t.ends_at).toISOString()!=='2027-01-01T02:00:00.000Z'||new Date(t.sales_end_at).toISOString()!=='2026-12-31T17:00:00.000Z')failures.push('NYE event or tier configuration is incomplete');
   const jobs=await db.query("SELECT count(*)::int AS count FROM email_jobs WHERE status IN ('unknown','bounced') OR (status='failed' AND attempts>=5)");if(jobs.rows[0].count)failures.push(`${jobs.rows[0].count} email jobs need review`);
   if(!(await db.query("SELECT 1 FROM ticket_worker_health WHERE worker='email' AND heartbeat_at>now()-interval '2 minutes'")).rowCount)failures.push('Email worker heartbeat is missing or stale');
   if((await db.query('SELECT 1 FROM stripe_event_receipts WHERE processed_at IS NULL LIMIT 1')).rowCount)failures.push('Stripe event receipts need reconciliation');
   if((await db.query('SELECT 1 FROM ticket_order_items i JOIN tickets t ON t.order_item_id=i.id GROUP BY i.id HAVING count(t.id)>i.quantity LIMIT 1')).rowCount)failures.push('Legacy duplicate admissions need review');
  }catch{failures.push('Database readiness query failed; check migrations and connectivity');}finally{await db.end();}
 }
 console.log(failures.length?failures.map(v=>`BLOCKED: ${v}`).join('\n'):'Automated readiness checks passed. Confirm Stripe, inbox and door-device evidence before launch.');
 process.exitCode=failures.length?1:0;
}
main();
