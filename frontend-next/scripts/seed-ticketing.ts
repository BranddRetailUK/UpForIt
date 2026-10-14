import { randomUUID } from 'node:crypto';
import { getPool } from '../lib/db';

// Explicit provisioning only. Never called on startup; reruns never reopen sales.
async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const event = await client.query<{id:string}>(`INSERT INTO events(id,slug,title,description,venue_name,timezone,starts_at,ends_at,status,sales_open,merch_discount_enabled)
      VALUES($1,'nye-2026','NYE 2026','£10 general admission. Buy 3 and get the fourth free.','McCarthys Sports Bar','Europe/London','2026-12-31T17:00:00Z','2027-01-01T02:00:00Z','draft',false,true)
      ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id`,[randomUUID()]);
    await client.query(`INSERT INTO ticket_types(id,event_id,name,price_minor,currency,capacity,max_per_order,is_active,sort_order,sales_end_at)
      VALUES($1,$2,'General admission',1000,'gbp',NULL,10,true,0,'2026-12-31T17:00:00Z') ON CONFLICT(event_id,name) DO NOTHING`,[randomUUID(),event.rows[0].id]);
    await client.query('COMMIT');
    console.log('NYE provisioning checked. No existing settings changed; new event is draft with sales closed.');
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error=>{ console.error(error instanceof Error ? error.message : 'Provisioning failed'); process.exitCode=1; });
