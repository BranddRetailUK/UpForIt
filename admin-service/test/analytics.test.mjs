import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficAnalytics} from '../traffic.mjs';
const env={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_ANALYTICS_API_TOKEN:'secret-token'};
const row=(label,count,visits)=>({dimensions:{label},count,sum:{visits}});
const response=data=>({ok:true,status:200,json:async()=>data});
test('traffic requires configuration and restricts query ranges',async()=>{
 const read=createTrafficAnalytics({env:{},fetcher:()=>assert.fail('Must not request without credentials')});
 assert.equal((await read()).state,'not_configured');assert.equal((await read(999)).reason,'invalid_range');
});
test('traffic isolates UTC days, preserves hostname scope and coalesces cached reads',async()=>{
 let calls=0;
 const read=createTrafficAnalytics({env,now:()=>new Date('2026-10-12T12:00:00Z'),fetcher:async(url,options)=>{
  calls++;const body=JSON.parse(options.body);
  if(body.variables.filter){
   assert.equal(body.variables.filter.datetime_geq,'2026-10-05T12:00:00.000Z');
   assert.match(body.query,/landings:.*sum_visits_DESC/);
   return response({data:{viewer:{accounts:[{total:[row('',1000,200)],daily:[],pages:[row('/events?private=abc',500,30)],landings:[row('/',200,170)]}]}}});
  }
  const account={};for(const [key,filter] of Object.entries(body.variables).filter(([k])=>k.startsWith('f'))){
   assert.deepEqual(filter.OR,[{requestHost:'upforitevents.co.uk'},{requestHost:'www.upforitevents.co.uk'}]);
   assert.ok(Date.parse(filter.datetime_lt)-Date.parse(filter.datetime_geq)<=86400000);
   account['d'+key.slice(1)]=[{count:3,sum:{visits:2},avg:{sampleInterval:1}}];
  }
  assert.doesNotMatch(body.query,/deviceType|userAgentBrowser|clientIP/);
  return response({data:{viewer:{accounts:[account]}}});
 }});
 const results=await Promise.all([read(),read()]);assert.equal(calls,3);
 assert.equal(results[0].pageviews,24);assert.equal(results[0].estimated,false);assert.equal(results[0].incomplete,false);
 assert.equal(results[0].pages[0].label,'/events');assert.equal(results[0].landings[0].visits,170);
 assert.ok(!JSON.stringify(results).includes('secret-token'));await read();assert.equal(calls,3);
});
test('GraphQL errors and missing accounts never display misleading zero totals',async()=>{
 for(const [payload,reason] of [[{errors:[{message:'not authorized for account secret-token'}]},'authorization'],[{data:{viewer:{accounts:[]}}},'provider'],[{errors:[{message:'unknown field'}],data:{viewer:{accounts:[{}]}}},'provider']]){
  const result=await createTrafficAnalytics({env,fetcher:async()=>response(payload)})();
  assert.deepEqual(result,{state:'error',reason});assert.ok(!JSON.stringify(result).includes('secret-token'));
 }
});
test('empty successful reports and network failure are distinct',async()=>{
 const data={total:[],daily:[],pages:[],landings:[]};
 assert.equal((await createTrafficAnalytics({env,fetcher:async()=>response({data:{viewer:{accounts:[data]}}})})()).pageviews,null);
 assert.equal((await createTrafficAnalytics({env,fetcher:async()=>{throw Error('timeout');}})()).reason,'unavailable');
});
test('Meta invalid-token errors are actionable and do not expose provider details',async()=>{
 const oldFetch=global.fetch,oldEnv={...process.env};
 try{
  process.env.META_AD_ACCOUNT_ID='act_123';process.env.META_MARKETING_API_ACCESS_TOKEN='private';
  global.fetch=async()=>({ok:false,status:401,json:async()=>({error:{code:190,message:'private'}})});
  const {metaAnalytics}=await import('../meta.mjs');
  assert.deepEqual(await metaAnalytics(),{state:'error',reason:'authorization'});
 }finally{global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);}
});
test('Meta retains paused campaigns and exposes effective status with zero-activity campaigns',async()=>{
 const oldFetch=global.fetch,oldEnv={...process.env};
 try{
  process.env.META_AD_ACCOUNT_ID='act_123';process.env.META_MARKETING_API_ACCESS_TOKEN='private';
  global.fetch=async url=>{
   const request=new URL(url);
   if(request.pathname.endsWith('/campaigns')){
    assert.equal(request.searchParams.has('filtering'),false);
    assert.match(request.searchParams.get('fields'),/effective_status/);
    return response({data:[{id:'1',name:'Live',status:'ACTIVE',effective_status:'ACTIVE'},{id:'2',name:'Paused',status:'PAUSED',effective_status:'PAUSED'}]});
   }
   return response({data:[{campaign_id:'1',spend:'12.50',impressions:'100',inline_link_clicks:'4'}]});
  };
  const {metaAnalytics}=await import('../meta.mjs');const result=await metaAnalytics();
  assert.equal(result.campaigns[1].status,'PAUSED');assert.equal(result.campaigns[1].spend,0);assert.equal(result.all.spend,12.5);
 }finally{global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);}
});
test('custom windows use exclusive bounds and distinct caches',async()=>{
 let calls=0;const filters=[];
 const read=createTrafficAnalytics({env,fetcher:async(url,options)=>{
  calls++;const body=JSON.parse(options.body);filters.push(body.variables.filter);
  return response({data:{viewer:{accounts:[{total:[],daily:[],pages:[],landings:[]}]}}});
 }});
 const first={since:'2026-09-01T00:00:00.000Z',until:'2026-09-02T00:00:00.000Z'};
 await read(first);await read({...first});await read({...first,until:'2026-09-01T12:00:00.000Z'});
 assert.equal(calls,2);assert.equal(filters[0].datetime_geq,first.since);assert.equal(filters[0].datetime_lt,first.until);
 assert.equal((await read({since:'bad',until:first.until})).reason,'invalid_range');
});
test('sampled history, exact recent values, explicit zeroes and missing days stay distinct',async()=>{
 const read=createTrafficAnalytics({env,fetcher:async(url,options)=>{
  const body=JSON.parse(options.body);
  if(body.variables.filter)return response({data:{viewer:{accounts:[{total:[row('',999,999)],daily:[],pages:[],landings:[]}]}}});
  return response({data:{viewer:{accounts:[{d0:[{count:20,sum:{visits:10},avg:{sampleInterval:10}}],d1:[],d2:[{count:0,sum:{visits:0},avg:{sampleInterval:1}}],d3:[{count:3,sum:{visits:2},avg:{sampleInterval:1}}]}]}}});
 }});
 const result=await read({since:'2026-10-01T00:00:00Z',until:'2026-10-05T00:00:00Z'});
 assert.equal(result.pageviews,23);assert.equal(result.visits,12);assert.equal(result.estimated,true);assert.equal(result.incomplete,true);assert.equal(result.missingDays,1);
 assert.deepEqual(result.daily.map(r=>[r.label,r.pageviews,r.estimated]),[['2026-10-01',20,true],['2026-10-03',0,false],['2026-10-04',3,false]]);
});
test('failed daily requests never fall back to misleading broad-query counts',async()=>{
 const read=createTrafficAnalytics({env,fetcher:async(url,options)=>{
  if(JSON.parse(options.body).variables.filter)return response({data:{viewer:{accounts:[{total:[row('',100,100)],daily:[row('2026-10-01',100,100)],pages:[],landings:[]}]}}});
  throw Error('provider failure');
 }});
 const result=await read(7);assert.equal(result.pageviews,null);assert.equal(result.incomplete,true);assert.deepEqual(result.daily,[]);
});
