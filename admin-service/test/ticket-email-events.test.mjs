import test from 'node:test';
import assert from 'node:assert/strict';
import {ingestTicketEmailEvents} from '../ticket-email-events.mjs';
const job='12345678-1234-1234-1234-123456789abc';
test('ticket routing ignores campaign and malformed events',async()=>{
 let calls=0;await ingestTicketEmailEvents({query:async()=>{calls++;}},[{event:'delivered',sg_event_id:'campaign',timestamp:1},{event:'delivered',sg_event_id:'bad',ticket_email_job_id:'invalid',timestamp:1}]);assert.equal(calls,0);
});
test('ticket bounce is correlated to job and database failure retries the webhook',async()=>{
 let values;await ingestTicketEmailEvents({query:async(_sql,v)=>{values=v;}},[{event:'bounce',sg_event_id:'bounce-1',ticket_email_job_id:job,timestamp:123}]);assert.deepEqual(values,['bounce-1',job,'bounce',123,'bounced']);
 await assert.rejects(()=>ingestTicketEmailEvents({query:async()=>{throw Error('unavailable');}},[{event:'delivered',sg_event_id:'delivery-1',ticket_email_job_id:job,timestamp:124}]),/unavailable/);
});
test('malformed entries cannot prevent a valid delivery in the same batch',async()=>{
 const calls=[];await ingestTicketEmailEvents({query:async(_sql,v)=>{calls.push(v);}},[
  null,42,{event:'delivered',sg_event_id:'invalid-date',ticket_email_job_id:job,timestamp:Infinity},
  {event:'delivered',sg_event_id:'invalid-uuid',ticket_email_job_id:'-'.repeat(36),timestamp:123},
  {event:'delivered',sg_event_id:'valid-delivery',ticket_email_job_id:job,timestamp:124}
 ]);assert.equal(calls.length,1);assert.equal(calls[0][0],'valid-delivery');
});
