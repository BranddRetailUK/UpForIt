import test from 'node:test';
import assert from 'node:assert/strict';
import {kpiSeries,kpiChart,chartScale,chartDateTicks} from '../public/kpi-chart.js';
test('website chart preserves missing UTC dates and preserves partial boundary days',()=>{
 const traffic={state:'ready',range:{since:'2026-10-01T20:00:00Z',until:'2026-10-03T20:00:00Z'},daily:[{label:'2026-10-01',pageviews:2},{label:'2026-10-03',pageviews:5}]};
 assert.deepEqual(kpiSeries([],traffic,'pageviews'),[{day:'2026-10-01',value:2},{day:'2026-10-02',value:null},{day:'2026-10-03',value:5}]);
 assert.equal(kpiSeries([],{state:'error'},'pageviews'),null);
 assert.equal(kpiSeries([],{state:'not_configured'},'visits'),null);
});
test('database metrics use numeric daily values and currency labels without depending on traffic reporting',()=>{
 const rows=[{day:'2026-10-19',revenue:'15.50',conversions:'2'},{day:'2026-10-20',revenue:'20',conversions:'1'}];
 assert.deepEqual(kpiSeries(rows,null,'conversions').map(r=>r.value),[2,1]);
 const html=kpiChart({rows,traffic:null,selected:'revenue',context:'overview'});
 assert.match(html,/£35.50/);assert.doesNotMatch(html,/Daily values|chart-dates/);assert.doesNotMatch(html,/NaN|Infinity/);
 const zero=kpiChart({rows:[{day:'2026-10-20',tickets:0}],selected:'tickets',context:'analytics'});
 assert.doesNotMatch(zero,/NaN|Infinity/);
});
test('custom range ends on the selected date without an extra zero day',()=>{
 const traffic={state:'ready',range:{since:'2026-10-01T00:00:00Z',until:'2026-10-03T00:00:00Z'},daily:[]};
 assert.deepEqual(kpiSeries([],traffic,'pageviews').map(r=>r.day),['2026-10-01','2026-10-02']);
 const html=kpiChart({rows:[],selected:'tickets',context:'analytics',selection:{period:'custom',from:'2026-10-01',to:'2026-10-02'},result:{state:'pending'}});
 assert.match(html,/Apply range/);assert.match(html,/24 hours/);assert.match(html,/7 days/);assert.match(html,/30 days/);assert.match(html,/Choose dates and apply/);assert.doesNotMatch(html,/<svg/);
});

test('axes use uniform readable increments and cover the complete value range',()=>{
 for(const peak of [0,1,7,18,999,15203]){const {ticks,step,max}=chartScale([peak]);assert.ok(max>=peak);assert.ok(ticks.length>=6);for(let i=1;i<ticks.length;i++)assert.equal(ticks[i]-ticks[i-1],step);}
 for(const length of [1,2,7,8,31,366]){const ticks=chartDateTicks(length);assert.ok(ticks.every(i=>i>=0&&i<length));for(let i=2;i<ticks.length;i++)assert.equal(ticks[i]-ticks[i-1],ticks[1]-ticks[0]);}
});

test('unrecorded history breaks lines and is not a zero total',()=>{
 const traffic={state:'ready',range:{since:'2026-10-01T00:00:00Z',until:'2026-10-04T00:00:00Z'},daily:[{label:'2026-10-01',pageviews:20},{label:'2026-10-03',pageviews:3}]};
 const html=kpiChart({rows:[],traffic,selected:'pageviews',context:'overview'});
 assert.match(html,/Partial data/);assert.equal((html.match(/<polyline /g)||[]).length,2);assert.equal((html.match(/<circle /g)||[]).length,2);
 const missing=kpiChart({rows:[],traffic:{...traffic,daily:[]},selected:'pageviews',context:'analytics'});
 assert.match(missing,/<strong>—<\/strong>/);assert.doesNotMatch(missing,/<circle |<polyline /);
});
