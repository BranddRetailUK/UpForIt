import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createTrafficAnalytics} from '../traffic.mjs';
const connection=new URL(process.env.DATABASE_URL||'postgresql://postgres@127.0.0.1:55439/postgres');
if(!['127.0.0.1','localhost','[::1]'].includes(connection.hostname))throw Error('Use a disposable local database only.');
const db=new pg.Client({connectionString:connection.href});
await db.connect();
try{
 await db.query('BEGIN');
 await db.query(await readFile(new URL('../../frontend-next/migrations/018_site_analytics.sql',import.meta.url),'utf8'));
 await db.query("UPDATE site_analytics_started SET started_at='2026-10-02T00:00:00Z'");
 const visitor=randomUUID(),session=randomUUID(),another=randomUUID();
 for(const [path,time,sess] of [['/','2026-10-02T10:00:00Z',session],['/events','2026-10-02T10:00:20Z',session],['/','2026-10-03T10:02:00Z',another]])await db.query('INSERT INTO site_page_hits(id,visitor_id,session_id,path,created_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),visitor,sess,path,time]);
 const read=createTrafficAnalytics({db});
 const result=await read({since:'2026-10-01T00:00:00Z',until:'2026-10-05T00:00:00Z'});
 assert.equal(result.state,'ready');assert.equal(result.pageviews,3);assert.equal(result.visits,2);assert.equal(result.visitors,1);
 assert.deepEqual(result.daily.map(d=>d.pageviews),[null,2,1,0]);
 assert.deepEqual(result.landings,[{label:'/',visits:2}]);
 const middle=await read({since:'2026-10-02T10:00:10Z',until:'2026-10-02T12:00:00Z'});
 assert.equal(middle.pageviews,1);assert.equal(middle.visits,0);
 console.log('PostgreSQL verified: hits, distinct visitors, session starts, landing pages, missing history, zero days and range boundaries.');
}finally{await db.query('ROLLBACK');await db.end();}
