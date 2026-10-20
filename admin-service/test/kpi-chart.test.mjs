import test from 'node:test';
import assert from 'node:assert/strict';
import {kpiSeries,kpiChart} from '../public/kpi-chart.js';
test('website chart fills missing UTC dates and preserves partial boundary days',()=>{
 const traffic={state:'ready',range:{since:'2026-10-01T20:00:00Z',until:'2026-10-03T20:00:00Z'},daily:[{label:'2026-10-01',pageviews:2},{label:'2026-10-03',pageviews:5}]};
 assert.deepEqual(kpiSeries([],traffic,'pageviews'),[{day:'2026-10-01',value:2},{day:'2026-10-02',value:0},{day:'2026-10-03',value:5}]);
 assert.equal(kpiSeries([],{state:'error'},'pageviews'),null);
 assert.equal(kpiSeries([],{state:'not_configured'},'visits'),null);
});
test('database metrics use numeric daily values and currency labels without depending on Cloudflare',()=>{
 const rows=[{day:'2026-10-19',revenue:'15.50',conversions:'2'},{day:'2026-10-20',revenue:'20',conversions:'1'}];
 assert.deepEqual(kpiSeries(rows,null,'conversions').map(r=>r.value),[2,1]);
 const html=kpiChart({rows,traffic:null,selected:'revenue',context:'overview'});
 assert.match(html,/£35.50/);assert.match(html,/Daily values/);assert.doesNotMatch(html,/NaN|Infinity/);
 const zero=kpiChart({rows:[{day:'2026-10-20',tickets:0}],selected:'tickets',context:'analytics'});
 assert.doesNotMatch(zero,/NaN|Infinity/);
});
