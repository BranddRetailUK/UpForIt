import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficAnalytics} from '../traffic.mjs';
const range={since:'2026-10-01T00:00:00Z',until:'2026-10-04T00:00:00Z'};
test('direct reporting coalesces requests and distinguishes untracked days from zero days',async()=>{
 let calls=0;
 const read=createTrafficAnalytics({db:{query:async(sql,params)=>{calls++;assert.deepEqual(params,[range.since,range.until,'YYYY-MM-DD']);assert.match(sql,/count\(DISTINCT visitor_id\)/);return {rows:[{started:'2026-10-02T12:00:00Z',pageviews:3,visits:1,visitors:1,daily:[{label:'2026-10-02',pageviews:3}],sessions:[{label:'2026-10-02',visits:1}]}]};}}});
 const results=await Promise.all([read(range),read(range)]);await read(range);
 assert.equal(calls,1);assert.equal(results[0].source,'direct');assert.equal(results[0].incomplete,true);
 assert.deepEqual(results[0].daily.map(d=>d.pageviews),[null,3,0]);
 assert.deepEqual(results[0].daily.map(d=>d.visits),[null,1,0]);
});
test('database failure is unavailable, never zero traffic',async()=>{
 const read=createTrafficAnalytics({db:{query:async()=>{throw Error('private db error');}}});
 assert.deepEqual(await read(range),{state:'error',reason:'unavailable'});
});

test('short traffic ranges return hourly buckets with unknown history and recorded zero hours',async()=>{
 const range={since:'2026-10-23T08:30:00Z',until:'2026-10-23T12:15:00Z'};
 const read=createTrafficAnalytics({db:{query:async()=>({rows:[{started:'2026-10-23T09:30:00Z',pageviews:4,visits:1,visitors:1,daily:[{label:'2026-10-23T10:00:00Z',pageviews:4}],sessions:[]}]})}});
 const result=await read(range);
 assert.equal(result.granularity,'hour');
 assert.deepEqual(result.daily.map(r=>r.pageviews),[null,0,4,0,0]);
 assert.equal(result.daily.at(-1).label,'2026-10-23T12:00:00Z');
});
