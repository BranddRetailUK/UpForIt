import {createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import QRCode from 'qrcode';
import {hash, httpError} from './security.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cookieName = 'upforit_scanner';
export function scannerToken(req) {
  const value = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value || '') ? value : null;
}
export function scannerCookie(token, expires, secure) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires.toUTCString()}${secure ? '; Secure' : ''}`;
}
export function verifyTicketCode(code, env = process.env) {
  const match = /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i.exec(code);
  if (!match) return null;
  const [, id, signature] = match, actual = Buffer.from(signature, 'base64url');
  if (actual.toString('base64url') !== signature) return null;
  const keys = [env.TICKET_QR_SIGNING_SECRET, ...(env.TICKET_QR_PREVIOUS_SIGNING_SECRETS || '').split(',')].filter(v => v?.trim());
  return keys.flatMap(v => [v, v.trim()]).some(key => {
    const expected = createHmac('sha256', key).update(`v1.${id}`).digest();
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }) ? id : null;
}
export async function scannerPrincipal(db, req) {
  const token = scannerToken(req);
  if (!token) return null;
  const row = (await db.query(`SELECT ss.id,ss.device_label FROM scanner_sessions ss JOIN events e ON e.id=ss.event_id
    WHERE ss.token_hash=$1 AND ss.revoked_at IS NULL AND ss.expires_at>now() AND e.status<>'cancelled' AND e.ends_at+interval '2 hours'>now()`, [hash(token)])).rows[0];
  return row ? {userId: null, scannerSessionId: row.id, deviceLabel: row.device_label} : null;
}
export async function checkIn(pool, principal, body) {
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 200 || !uuid.test(body.requestId || '')) throw httpError(400, 'Scan or enter a valid ticket code.');
  const publicId = verifyTicketCode(code);
  if (!publicId && !/^UFI-T-[0-9]{6,12}$/i.test(code)) throw httpError(400, 'That QR signature is invalid. Use a ticket from this environment.');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    if (principal.scannerSessionId) {
      const access = await db.query(`SELECT id FROM scanner_sessions WHERE id=$1 AND revoked_at IS NULL AND expires_at>now() FOR UPDATE`, [principal.scannerSessionId]);
      if (!access.rowCount) throw httpError(401, 'Scanner access has ended. Ask for a new scanner QR.');
    }
    // The ticket identifies its event. Neither a UI selection nor a device event filter controls admission.
    const ticket = (await db.query(`SELECT t.id,t.ticket_number,t.ticket_type_name,t.status,t.checked_in_at,u.display_name,e.title AS event_title,
      (e.status='published' AND now()>=e.starts_at-interval '2 hours') AS live_check_in
      FROM tickets t JOIN ticket_orders o ON o.id=t.order_id JOIN users u ON u.id=t.user_id JOIN events e ON e.id=t.event_id
      WHERE ${publicId ? 't.public_id=$1' : 'upper(t.ticket_number)=upper($1)'} AND e.status NOT IN ('cancelled','completed')
      AND now()<e.ends_at+interval '2 hours' AND o.status IN ('paid','refund_review') AND o.admissions_hold=false
      FOR UPDATE OF o,t`, [publicId || code])).rows[0];
    if (!ticket) throw httpError(404, 'Ticket unavailable. It may be held, refunded, or for an event that has ended.');
    if (ticket.status === 'void') throw Object.assign(httpError(409, 'This ticket is void.'), {ticket});
    if (ticket.status === 'checked_in') {
      const replay = await db.query(`SELECT id FROM ticket_audit_log WHERE ticket_id=$1 AND action='checked_in'
        AND details->>'scanRequestId'=$2 AND actor_user_id IS NOT DISTINCT FROM $3::uuid
        AND scanner_session_id IS NOT DISTINCT FROM $4::uuid`, [ticket.id, body.requestId, principal.userId, principal.scannerSessionId]);
      if (!replay.rowCount) throw Object.assign(httpError(409, 'This ticket has already been checked in.'), {ticket});
      await db.query('COMMIT');
      return {ok: true, replayed: true, ticket};
    }
    if (!ticket.live_check_in) {
      await db.query('COMMIT');
      return {ok: true, validationOnly: true, ticket};
    }
    const updated = await db.query("UPDATE tickets SET status='checked_in',checked_in_at=now(),checked_in_by=$2 WHERE id=$1 RETURNING checked_in_at", [ticket.id, principal.userId]);
    await db.query(`INSERT INTO ticket_audit_log(id,actor_user_id,scanner_session_id,ticket_id,action,details)
      VALUES($1,$2,$3,$4,'checked_in',$5::jsonb)`, [randomUUID(), principal.userId, principal.scannerSessionId, ticket.id, JSON.stringify({deviceLabel: principal.deviceLabel, scanRequestId: body.requestId})]);
    if (principal.scannerSessionId) await db.query('UPDATE scanner_sessions SET last_seen_at=now() WHERE id=$1', [principal.scannerSessionId]);
    await db.query('COMMIT');
    return {ok: true, ticket: {...ticket, status: 'checked_in', checked_in_at: updated.rows[0].checked_in_at}};
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}

export async function activateScanner(pool, body, userAgent) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(body.token || '')) throw httpError(400, 'That scanner access QR is invalid.');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const enrolment = (await db.query(`SELECT se.*,e.ends_at FROM scanner_enrolments se JOIN events e ON e.id=se.event_id
      WHERE se.token_hash=$1 AND se.closed_at IS NULL AND se.expires_at>now() AND e.status<>'cancelled'
      AND e.ends_at+interval '2 hours'>now() FOR UPDATE OF se`, [hash(body.token)])).rows[0];
    if (!enrolment) throw httpError(410, 'That scanner access QR has expired or been closed.');
    if (body.mode === 'relink' && !enrolment.relink_session_id) throw httpError(400, 'Use a relink QR for this device.');
    const token = randomBytes(32).toString('base64url'), expires = new Date(new Date(enrolment.ends_at).getTime() + 7200000);
    const agent = typeof userAgent === 'string' ? userAgent.slice(0, 300) : null;
    if (enrolment.relink_session_id) {
      const result = await db.query(`UPDATE scanner_sessions SET token_hash=$2,user_agent=$3,expires_at=$4,last_seen_at=now(),revoked_at=NULL,revoked_by=NULL
        WHERE id=$1 AND event_id=$5 RETURNING id`, [enrolment.relink_session_id, hash(token), agent, expires, enrolment.event_id]);
      if (!result.rowCount) throw httpError(410, 'Scanner device no longer exists.');
      await db.query('UPDATE scanner_enrolments SET closed_at=now() WHERE id=$1', [enrolment.id]);
    } else {
      const count = (await db.query(`SELECT count(*)::int total,count(*) FILTER(WHERE revoked_at IS NULL AND expires_at>now())::int active FROM scanner_sessions WHERE enrolment_id=$1`, [enrolment.id])).rows[0];
      if (count.active >= enrolment.max_devices) throw httpError(409, 'The maximum number of scanner devices is already active.');
      const label = (typeof body.label === 'string' ? body.label.trim().replace(/\s+/g, ' ').slice(0, 60) : '') || `Door device ${count.total + 1}`;
      await db.query(`INSERT INTO scanner_sessions(id,enrolment_id,event_id,token_hash,device_label,user_agent,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), enrolment.id, enrolment.event_id, hash(token), label, agent, expires]);
    }
    await db.query('COMMIT');
    return {token, expires};
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}

export async function scannerDevices(db) {
  return (await db.query(`SELECT ss.id,ss.device_label,ss.expires_at,ss.revoked_at,ss.last_seen_at,
    (SELECT count(*)::int FROM ticket_audit_log a WHERE a.scanner_session_id=ss.id AND a.action='checked_in') AS scan_count
    FROM scanner_sessions ss WHERE expires_at>now() ORDER BY created_at DESC LIMIT 100`)).rows;
}
export async function enrolScanner(pool, userId, body, origin) {
  if (body.sessionId && !uuid.test(body.sessionId)) throw httpError(400, 'Invalid scanner device.');
  const db = await pool.connect();
  let token, expires, eventTitle;
  try {
    await db.query('BEGIN');
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended('admin-scanner-enrolment',0))");
    // Event linkage controls session expiry only; scanning always derives the event from the ticket.
    const event = (await db.query(`SELECT e.id,e.ends_at,e.title FROM events e WHERE e.status NOT IN ('cancelled','completed') AND e.ends_at+interval '2 hours'>now()
      AND ($1::uuid IS NULL OR e.id=(SELECT event_id FROM scanner_sessions WHERE id=$1))
      ORDER BY (now()>=e.starts_at-interval '2 hours') DESC,e.starts_at LIMIT 1 FOR UPDATE`, [body.sessionId || null])).rows[0];
    if (!event) throw httpError(409, 'No current or upcoming event is available for scanner access.');
    token = randomBytes(32).toString('base64url'); expires = new Date(Date.now() + 600000); eventTitle = event.title;
    await db.query('UPDATE scanner_enrolments SET closed_at=now() WHERE event_id=$1 AND closed_at IS NULL', [event.id]);
    await db.query(`INSERT INTO scanner_enrolments(id,event_id,created_by,token_hash,expires_at,max_devices,relink_session_id) VALUES($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), event.id, userId, hash(token), expires, body.sessionId ? 1 : 20, body.sessionId || null]);
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
  const url = new URL('/scan/activate', origin);
  if (body.sessionId) url.searchParams.set('mode', 'relink');
  url.hash = new URLSearchParams({token}).toString();
  return {qrDataUrl: await QRCode.toDataURL(url.toString(), {width: 600, margin: 2}), expires, eventTitle};
}
export async function revokeScanner(pool, userId, id) {
  if (!uuid.test(id || '')) throw httpError(400, 'Invalid scanner device.');
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('UPDATE scanner_enrolments SET closed_at=now() WHERE relink_session_id=$1 AND closed_at IS NULL', [id]);
    await db.query('UPDATE scanner_sessions SET revoked_at=now(),revoked_by=$2 WHERE id=$1', [id, userId]);
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}
