import { createPublicKey, verify } from 'node:crypto';
import type { PoolClient } from 'pg';
export function verifyEmailEventSignature(body:string,timestamp:string,signature:string,key:string,now=Date.now()){
 try{
  if(!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
  const publicKey=key.includes('BEGIN PUBLIC KEY')?createPublicKey(key):createPublicKey({key:Buffer.from(key,'base64'),format:'der',type:'spki'});
  return verify('sha256',Buffer.from(timestamp+body),publicKey,Buffer.from(signature,'base64'));
 }catch{return false;}
}
export async function recordTicketEmailEvents(db:PoolClient,events:Array<Record<string,unknown>>){
 for(const event of events){
  const id=event.sg_event_id,job=event.ticket_email_job_id;
  if(typeof id!=='string'||typeof job!=='string'||!/^[0-9a-f-]{36}$/i.test(job)||typeof event.timestamp!=='number'||!['delivered','bounce','dropped','processed','deferred'].includes(String(event.event)))continue;
  const inserted=await db.query(`INSERT INTO ticket_email_events(id,job_id,event,occurred_at) SELECT $1,id,$3,to_timestamp($4) FROM email_jobs WHERE id=$2 ON CONFLICT(id) DO NOTHING RETURNING id`,[id,job,event.event,event.timestamp]);
  if(!inserted.rowCount)continue;
  const status=event.event==='delivered'?'delivered':['bounce','dropped'].includes(String(event.event))?'bounced':event.event==='processed'?'sent':null;
  if(status)await db.query(`UPDATE email_jobs SET status=$2,delivery_updated_at=to_timestamp($3),updated_at=now() WHERE id=$1 AND (delivery_updated_at IS NULL OR delivery_updated_at<=to_timestamp($3)) AND (status NOT IN ('delivered','bounced') OR $2 IN ('delivered','bounced'))`,[job,status,event.timestamp]);
 }
}
