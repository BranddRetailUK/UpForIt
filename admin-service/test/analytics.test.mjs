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
test('traffic uses separate totals and landing ranking, limits scope and caches',async()=>{
 let calls=0;
 const read=createTrafficAnalytics({env,now:()=>new Date('2026-10-12T12:00:00Z'),fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.cloudflare.com/client/v4/graphql');
  const body=JSON.parse(options.body);assert.deepEqual(body.variables.filter.OR,[{requestHost:'upforitevents.co.uk'},{requestHost:'www.upforitevents.co.uk'}]);
  assert.equal(body.variables.filter.datetime_geq,'2026-10-05T12:00:00.000Z');
  assert.match(body.query,/landings:.*sum_visits_DESC/);assert.doesNotMatch(body.query,/deviceType|userAgentBrowser|clientIP/);
  return response({data:{viewer:{accounts:[{total:[row('',1000,200)],daily:[row('2026-10-12',1000,200)],pages:[row('/events?private=abc',500,30)],landings:[row('/',200,170)]}]}}});
 }});
 const results=await Promise.all([read(),read()]);assert.equal(calls,1);
 assert.equal(results[0].pageviews,1000);assert.equal(results[0].pages[0].label,'/events');assert.equal(results[0].landings[0].visits,170);
 assert.ok(!JSON.stringify(results).includes('secret-token'));await read();assert.equal(calls,1);
});
test('GraphQL errors and missing accounts never display misleading zero totals',async()=>{
 for(const [payload,reason] of [[{errors:[{message:'not authorized for account secret-token'}]},'authorization'],[{data:{viewer:{accounts:[]}}},'provider'],[{errors:[{message:'unknown field'}],data:{viewer:{accounts:[{}]}}},'provider']]){
  const result=await createTrafficAnalytics({env,fetcher:async()=>response(payload)})();
  assert.deepEqual(result,{state:'error',reason});assert.ok(!JSON.stringify(result).includes('secret-token'));
 }
});
test('empty successful reports and network failure are distinct',async()=>{
 const data={total:[],daily:[],pages:[],landings:[]};
 assert.equal((await createTrafficAnalytics({env,fetcher:async()=>response({data:{viewer:{accounts:[data]}}})})()).pageviews,0);
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
