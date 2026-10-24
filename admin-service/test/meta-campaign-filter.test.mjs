import test from 'node:test';
import assert from 'node:assert/strict';
import {kpiCards} from '../public/kpi-chart.js';
test('campaign report isolates metrics, ads and caches while retaining active options',async()=>{
 process.env.META_AD_ACCOUNT_ID='act_123';process.env.META_MARKETING_API_ACCESS_TOKEN='test';
 const original=global.fetch;
 global.fetch=async input=>{const u=new URL(input);let data;
 if(u.pathname.endsWith('/campaigns'))data=[{id:'1',name:'One',status:'ACTIVE'},{id:'2',name:'Two',status:'ACTIVE'},{id:'3',status:'PAUSED'}];
 else if(u.pathname.endsWith('/ads'))data=[{id:'a',campaign_id:'1',effective_status:'PENDING_REVIEW'},{id:'b',campaign_id:'2'}];
 else data=[{campaign_id:'1',ad_id:'a',spend:'4',inline_link_clicks:'2'},{campaign_id:'2',ad_id:'b',spend:'9',inline_link_clicks:'3'}];
 return {ok:true,json:async()=>({data})};};
 try{const {metaAnalytics}=await import('../meta.mjs?filter-test');const one=await metaAnalytics('1'),all=await metaAnalytics(),two=await metaAnalytics('2');assert.equal(one.all.spend,4);assert.equal(two.all.spend,9);assert.equal(all.all.spend,13);assert.deepEqual(one.campaignOptions.map(c=>c.id),['1','2']);assert.deepEqual(one.ads.rows.map(a=>a.id),['a']);assert.equal(one.ads.rows[0].status,'PENDING_REVIEW');assert.equal(one.breakdowns.devices.rows[0].spend,4);assert.equal((await metaAnalytics('1')).all.spend,4);}finally{global.fetch=original;}
});
test('campaign graph filters rows and uses separate cache entries',async()=>{
 process.env.META_AD_ACCOUNT_ID='act_123';process.env.META_MARKETING_API_ACCESS_TOKEN='test';const original=global.fetch;
 global.fetch=async input=>{const u=new URL(input);return {ok:true,json:async()=>u.pathname.endsWith('/insights')?{data:['1','2'].map(id=>({campaign_id:id,date_start:'2026-10-24',hourly_stats_aggregated_by_advertiser_time_zone:'00:00:00 - 00:59:59',spend:id==='1'?'4':'9'}))}:{timezone_name:'UTC'}};};
 try{const {metaSeries}=await import('../meta-series.mjs?filter-test');const range={since:'2026-10-24T00:00:00Z',until:'2026-10-24T02:00:00Z'};assert.equal((await metaSeries(range,'1')).all.spend,4);assert.equal((await metaSeries(range,'2')).all.spend,9);assert.equal((await metaSeries(range)).all.spend,13);}finally{global.fetch=original;}
});
test('campaign cards exclude unattributed site-wide metrics',()=>{const html=kpiCards({context:'analytics',campaignOnly:true,selected:'spend',adSeries:{state:'ready',all:{spend:4,impressions:9,clicks:2}}});assert.match(html,/£4.00/);assert.doesNotMatch(html,/data-kpi="(pageviews|conversions|revenue)"/);});
