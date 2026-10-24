import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateMetaHours,metaSeries} from '../meta-series.mjs';
import {kpiCards,kpiChart} from '../public/kpi-chart.js';
const row=(date,hour,extra={})=>({campaign_id:'current',date_start:date,hourly_stats_aggregated_by_advertiser_time_zone:`${hour}:00:00 - ${hour}:59:59`,spend:'1.25',impressions:'10',inline_link_clicks:'2',...extra});
test('Meta hours convert account timezone to UTC and exclude retired campaigns/outside range',()=>{
 const range={since:'2026-10-23T10:37:00Z',until:'2026-10-23T12:37:00Z'};
 const result=aggregateMetaHours([row('2026-10-23','11'),row('2026-10-23','12'),row('2026-10-23','10'),row('2026-10-23','11',{campaign_id:'120255565688880428'})],range,'Europe/London');
 assert.equal(result.rows[0].day,'2026-10-23T10:00:00.000Z');assert.equal(result.rows.length,3);assert.deepEqual(result.all,{spend:2.5,impressions:20,clicks:4});assert.equal(result.rows[2].clicks,0);
});
test('daily grouping crosses UK midnight correctly and counts repeated DST hour only once',()=>{
 const result=aggregateMetaHours([row('2026-10-24','00'),row('2026-10-25','01')],{since:'2026-10-22T00:00:00Z',until:'2026-10-26T00:00:00Z'},'Europe/London');
 assert.equal(result.rows.find(r=>r.day==='2026-10-23').spend,1.25);assert.equal(result.all.spend,2.5);
 assert.throws(()=>aggregateMetaHours([row('2026-10-25','01')],{since:'2026-10-25T00:00:00Z',until:'2026-10-25T03:00:00Z'},'Europe/London'),/Ambiguous/);
});
test('ad cards select series, show range totals and currency graph tooltips',()=>{
 const adSeries=aggregateMetaHours([row('2026-10-23','11')],{since:'2026-10-23T10:00:00Z',until:'2026-10-23T12:00:00Z'},'Europe/London');
 const props={context:'analytics',selected:'spend',result:{state:'ready'},rows:[],adSeries};
 assert.match(kpiCards(props),/data-kpi="spend" aria-pressed="true"/);assert.match(kpiCards(props),/£1.25/);
 assert.match(kpiChart(props),/Amount spent: £1.25/);assert.match(kpiChart({...props,selected:'clicks'}),/Link clicks: 2/);
 assert.match(kpiChart({...props,adSeries:{state:'error'}}),/Meta graph unavailable/);
});
test('Meta series sanitizes provider errors',async()=>{
 const saved=global.fetch,old=process.env.META_AD_ACCOUNT_ID,token=process.env.META_MARKETING_API_ACCESS_TOKEN;
 process.env.META_AD_ACCOUNT_ID='act_123';process.env.META_MARKETING_API_ACCESS_TOKEN='secret';global.fetch=async()=>({ok:false,json:async()=>({error:{message:'secret'}})});
 try{const value=await metaSeries({since:'2020-01-01T00:00:00Z',until:'2020-01-02T00:00:00Z'});assert.equal(value.state,'error');assert.doesNotMatch(JSON.stringify(value),/secret/);}finally{global.fetch=saved;if(old===undefined)delete process.env.META_AD_ACCOUNT_ID;else process.env.META_AD_ACCOUNT_ID=old;if(token===undefined)delete process.env.META_MARKETING_API_ACCESS_TOKEN;else process.env.META_MARKETING_API_ACCESS_TOKEN=token;}
});
