import {randomInt,randomUUID} from 'node:crypto';
import {httpError} from './security.mjs';
const validTicket = `t.status IN ('valid','checked_in') AND o.status IN ('paid','refund_review') AND NOT o.admissions_hold
  AND t.event_id=o.event_id AND t.user_id=o.user_id`;
async function eventInfo(db, lock = false) {
  return (await db.query(`SELECT id,status,
    (status='published' AND clock_timestamp()<starts_at) AS entry_open,
    (status='published' AND clock_timestamp()>=starts_at AND clock_timestamp()<LEAST(ends_at,starts_at+interval '2 hours')) AS draw_open
    FROM events WHERE slug=$1 ${lock ? 'FOR UPDATE' : ''}`, ['nye-2026'])).rows[0];
}
async function audit(db, entryId, actorId, action) {
  await db.query('INSERT INTO bucket_audit(id,entry_id,actor_id,action) VALUES($1,$2,$3,$4)', [randomUUID(),entryId,actorId,action]);
}
export async function adminBucketData(db) {
  const event = await eventInfo(db);
  if (!event) return {drawOpen:false,entries:[],audit:[]};
  const entries = await db.query(`SELECT b.id,b.dj_name,b.status,b.created_at,b.called_at,b.resolved_at,u.email,u.display_name,
    (u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL AND EXISTS(SELECT 1 FROM tickets t JOIN ticket_orders o ON o.id=t.order_id WHERE t.user_id=b.user_id AND t.event_id=b.event_id AND ${validTicket})) AS eligible,
    EXISTS(SELECT 1 FROM tickets t JOIN ticket_orders o ON o.id=t.order_id WHERE t.user_id=b.user_id AND t.event_id=b.event_id AND ${validTicket} AND t.status='checked_in') AS checked_in
    FROM bucket_entries b JOIN users u ON u.id=b.user_id WHERE b.event_id=$1 ORDER BY b.created_at,b.id`,[event.id]);
  const log = await db.query(`SELECT a.action,a.created_at,b.dj_name,u.display_name AS actor FROM bucket_audit a
    JOIN bucket_entries b ON b.id=a.entry_id JOIN users u ON u.id=a.actor_id WHERE b.event_id=$1 ORDER BY a.created_at DESC LIMIT 100`,[event.id]);
  return {drawOpen:event.draw_open,entries:entries.rows,audit:log.rows};
}
export async function administerBucket(pool, actorId, action, entryId) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const event = await eventInfo(db,true);
    if (!event?.draw_open) throw httpError(409,'The live draw is available during the event’s first two hours.');
    const entries = (await adminBucketData(db)).entries;
    if (action === 'draw') {
      if (entries.some(e=>e.status==='called')) throw httpError(409,'Resolve the current called DJ before drawing another name.');
      if (entries.filter(e=>e.status==='played').length>=8) throw httpError(409,'All eight DJ slots have been filled.');
      const candidates = entries.filter(e=>e.status==='entered' && e.eligible);
      if (!candidates.length) throw httpError(409,'No eligible names remain in the bucket.');
      const chosen = candidates[randomInt(candidates.length)];
      await db.query("UPDATE bucket_entries SET status='called',called_at=clock_timestamp() WHERE id=$1",[chosen.id]);
      await audit(db,chosen.id,actorId,'called');
    } else if (action==='played' || action==='skipped') {
      const entry = entries.find(e=>e.id===entryId && e.status==='called');
      if (!entry) throw httpError(409,'Choose the currently called DJ.');
      if (action==='played' && !entry.eligible) throw httpError(409,'This DJ no longer has an eligible ticket. Skip this name.');
      await db.query('UPDATE bucket_entries SET status=$2,resolved_at=clock_timestamp() WHERE id=$1',[entry.id,action]);
      await audit(db,entry.id,actorId,action);
    } else throw httpError(400,'Unknown action.');
    await db.query('COMMIT');
  } catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
