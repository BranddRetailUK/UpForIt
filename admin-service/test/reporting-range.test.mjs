import test from 'node:test';
import assert from 'node:assert/strict';
import {reportingRange} from '../reporting-range.mjs';
const now=new Date('2026-10-20T14:20:00Z');
const range=query=>reportingRange(new URLSearchParams(query),now);
test('presets use exact rolling windows',()=>{
 for(const days of [1,7,30]){const r=range('days='+days);assert.equal(Date.parse(r.until)-Date.parse(r.since),days*86400000);assert.equal(r.until,now.toISOString());}
});
test('custom dates are inclusive UTC days and today ends at current time',()=>{
 assert.equal(range('from=2026-10-01&to=2026-10-07').since,'2026-10-01T00:00:00.000Z');
 assert.equal(range('from=2026-10-01&to=2026-10-07').until,'2026-10-08T00:00:00.000Z');
 assert.equal(range('from=2026-10-20&to=2026-10-20').until,now.toISOString());
 assert.equal(range('from=2024-02-29&to=2024-02-29').days,1);
});
test('reject invalid, reversed, incomplete, future and unbounded date ranges',()=>{
 for(const query of ['days=999','from=2026-02-30&to=2026-03-02','from=2026-10-20','from=2026-10-20&to=2026-10-19','from=2026-10-20&to=2026-10-21','from=2024-01-01&to=2026-01-01'])assert.throws(()=>range(query),{status:400});
});

test('calendar presets use UTC boundaries',()=>{
 assert.equal(range('days=mtd').since,'2026-10-01T00:00:00.000Z');
 assert.equal(range('days=today').since,'2026-10-20T00:00:00.000Z');
 assert.equal(range('days=yesterday').until,'2026-10-20T00:00:00.000Z');
 assert.equal(range('days=lastmonth').since,'2026-09-01T00:00:00.000Z');
 assert.equal(range('days=lastmonth').until,'2026-10-01T00:00:00.000Z');
 assert.equal(range('days=ytd').since,'2026-01-01T00:00:00.000Z');
});
