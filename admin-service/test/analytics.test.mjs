import test from 'node:test';
import assert from 'node:assert/strict';
const response=data=>({ok:true,status:200,json:async()=>data});
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
