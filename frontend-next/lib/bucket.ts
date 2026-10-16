import { randomInt, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "./db";
import type { AuthUser } from "./auth";
import { BUCKET_SLUG, BucketError, type BucketStatus } from "./bucket-shared";

type DB = Pick<PoolClient, "query">;
type EventRow = { id: string; status: string; entry_open: boolean; draw_open: boolean };
// Re-evaluate current admission entitlement, including refunds/disputes, for every use.
const validTicket = `t.status IN ('valid','checked_in') AND o.status IN ('paid','refund_review') AND NOT o.admissions_hold
  AND t.event_id=o.event_id AND t.user_id=o.user_id`;
async function eventInfo(db: DB, lock = false) {
  return (await db.query<EventRow>(`SELECT id,status,
    (status='published' AND clock_timestamp()<starts_at) AS entry_open,
    (status='published' AND clock_timestamp()>=starts_at AND clock_timestamp()<LEAST(ends_at,starts_at+interval '2 hours')) AS draw_open
    FROM events WHERE slug=$1 ${lock ? 'FOR UPDATE' : ''}`, [BUCKET_SLUG])).rows[0];
}
async function entitlement(db: DB, userId: string, eventId: string) {
  return (await db.query<{ id: string }>(`SELECT t.id FROM tickets t JOIN ticket_orders o ON o.id=t.order_id
    WHERE t.user_id=$1 AND t.event_id=$2 AND ${validTicket} ORDER BY t.created_at,t.id LIMIT 1`, [userId,eventId])).rows[0];
}
export async function bucketStatus(user: AuthUser | null, db: DB = getPool()): Promise<BucketStatus> {
  const event = await eventInfo(db);
  if (event?.status === 'draft') return { state: 'upcoming' };
  if (!event || event.status !== 'published') return { state: 'closed' };
  if (!user) return { state: event.entry_open ? 'signed-out' : 'closed' };
  if (!user.emailVerified) return { state: event.entry_open ? 'verify-email' : 'closed' };
  const entry = (await db.query<{ dj_name: string; status: NonNullable<BucketStatus['entryStatus']> }>(
    'SELECT dj_name,status FROM bucket_entries WHERE event_id=$1 AND user_id=$2', [event.id,user.id])).rows[0];
  const ticket = await entitlement(db,user.id,event.id);
  if (entry) return { state: ticket ? 'entered' : 'ticket-inactive', djName:entry.dj_name, entryStatus:entry.status };
  if (!event.entry_open) return { state:'closed' };
  return { state: ticket ? 'eligible' : 'no-ticket' };
}
async function audit(db: DB, entryId: string, actorId: string, action: string) {
  await db.query('INSERT INTO bucket_audit(id,entry_id,actor_id,action) VALUES($1,$2,$3,$4)', [randomUUID(),entryId,actorId,action]);
}
export async function enterBucket(user: AuthUser, djName: string) {
  if (!user.emailVerified) throw new BucketError('Verify your email before entering.',403);
  const db = await getPool().connect();
  try {
    await db.query('BEGIN');
    // The event lock serializes submissions and draws, including duplicate POSTs.
    const event = await eventInfo(db,true);
    if (!event) throw new BucketError('Entries are closed.',409);
    const status = await bucketStatus(user,db);
    if (status.state === 'entered') { await db.query('COMMIT'); return status; }
    if (status.state === 'closed') throw new BucketError('Entries are closed. The draw starts at doors.',409);
    if (status.state !== 'eligible') throw new BucketError('A valid NYE ticket on your account is required.',403);
    const ticket = await entitlement(db,user.id,event.id);
    if (!ticket) throw new BucketError('Your ticket is no longer eligible.',403);
    const id = randomUUID();
    await db.query('INSERT INTO bucket_entries(id,event_id,user_id,ticket_id,dj_name) VALUES($1,$2,$3,$4,$5)',[id,event.id,user.id,ticket.id,djName]);
    await audit(db,id,user.id,'entered');
    await db.query('COMMIT');
    return {state:'entered',djName,entryStatus:'entered'} satisfies BucketStatus;
  } catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
export async function adminBucketData(db: DB = getPool()) {
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
export async function administerBucket(actorId: string, action: string, entryId?: string) {
  const db = await getPool().connect();
  try {
    await db.query('BEGIN');
    const event = await eventInfo(db,true);
    if (!event?.draw_open) throw new BucketError('The live draw is available during the event’s first two hours.',409);
    const entries = (await adminBucketData(db)).entries;
    if (action === 'draw') {
      if (entries.some(e=>e.status==='called')) throw new BucketError('Resolve the current called DJ before drawing another name.',409);
      if (entries.filter(e=>e.status==='played').length>=8) throw new BucketError('All eight DJ slots have been filled.',409);
      const candidates = entries.filter(e=>e.status==='entered' && e.eligible);
      if (!candidates.length) throw new BucketError('No eligible names remain in the bucket.',409);
      const chosen = candidates[randomInt(candidates.length)];
      await db.query("UPDATE bucket_entries SET status='called',called_at=clock_timestamp() WHERE id=$1",[chosen.id]);
      await audit(db,chosen.id,actorId,'called');
    } else if (action==='played' || action==='skipped') {
      const entry = entries.find(e=>e.id===entryId && e.status==='called');
      if (!entry) throw new BucketError('Choose the currently called DJ.',409);
      if (action==='played' && !entry.eligible) throw new BucketError('This DJ no longer has an eligible ticket. Skip this name.',409);
      await db.query('UPDATE bucket_entries SET status=$2,resolved_at=clock_timestamp() WHERE id=$1',[entry.id,action]);
      await audit(db,entry.id,actorId,action);
    } else throw new BucketError('Unknown action.');
    await db.query('COMMIT');
  } catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
