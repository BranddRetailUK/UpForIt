// Called only after the existing SendGrid endpoint verifies its signature.
export async function ingestTicketEmailEvents(db, events) {
 if (!Array.isArray(events)) return;
 for (const event of events) {
  if (!event || typeof event !== 'object') continue;
  const id=event.sg_event_id, job=event.ticket_email_job_id;
  if(typeof id!=='string'||!id.length||id.length>200||typeof job!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job)||!Number.isFinite(event.timestamp)||event.timestamp<0||event.timestamp>4102444800||!['delivered','bounce','dropped','processed','deferred'].includes(event.event))continue;
  // One statement makes deduplication and status advancement atomic on the pool.
  const status=event.event==='delivered'?'delivered':['bounce','dropped'].includes(event.event)?'bounced':event.event==='processed'?'sent':null;
  await db.query(`WITH recorded AS (
   INSERT INTO ticket_email_events(id,job_id,event,occurred_at)
   SELECT $1,id,$3,to_timestamp($4) FROM email_jobs WHERE id=$2
   ON CONFLICT(id) DO NOTHING RETURNING job_id
  ) UPDATE email_jobs SET status=$5,delivery_updated_at=to_timestamp($4),updated_at=now()
  WHERE id IN (SELECT job_id FROM recorded) AND $5::text IS NOT NULL
  AND (delivery_updated_at IS NULL OR delivery_updated_at<=to_timestamp($4))
  AND (status NOT IN ('delivered','bounced') OR $5 IN ('delivered','bounced'))`,[id,job,event.event,event.timestamp,status]);
 }
}
