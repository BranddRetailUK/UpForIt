const metrics={pageviews:'Page hits',visits:'Website visits',tickets:'Tickets issued',conversions:'Conversions · paid orders',revenue:'Net ticket revenue',signups:'Email sign-ups',mixes:'Mix entries'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(value,key)=>key==='revenue'?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(value):Number(value).toLocaleString('en-GB');
export function kpiSeries(rows,traffic,key){
 if(!Object.hasOwn(metrics,key))return null;
 const website=['pageviews','visits'].includes(key);
 if(website&&traffic?.state!=='ready')return null;
 // Both sources use UTC days, including partial first/last days in a rolling window.
 const values=new Map((website?traffic.daily:rows).map(row=>[row.day||row.label,Number(row[key]||0)]));
 const start=website?traffic.range.since.slice(0,10):rows[0]?.day;
 const end=website?new Date(Date.parse(traffic.range.until)-1).toISOString().slice(0,10):rows.at(-1)?.day;
 if(!start||!end)return [];
 const result=[];
 for(let day=new Date(start+'T00:00:00Z');day.toISOString().slice(0,10)<=end;day.setUTCDate(day.getUTCDate()+1)){
  const label=day.toISOString().slice(0,10);result.push({day:label,value:values.get(label)||0});
 }
 return result;
}
export function kpiChart({rows,traffic,selected,context,selection={period:'30'},result}){
 const key=Object.hasOwn(metrics,selected)?selected:'signups',series=kpiSeries(rows,traffic,key);
 const periodLabel=selection.period==='custom'?`${selection.from} — ${selection.to}`:selection.period==='1'?'Last 24 hours':`Last ${selection.period} days`;
 const today=new Date().toISOString().slice(0,10);
 const controls=`<div class="kpi-controls"><label>KPI <select data-kpi="${escape(context)}" aria-label="${escape(context)} graph KPI">${Object.entries(metrics).map(([id,label])=>`<option value="${id}" ${key===id?'selected':''}>${label}</option>`).join('')}</select></label><label>Date range <select data-chart-period="${escape(context)}" aria-label="${escape(context)} graph date range">${[['1','24 hours'],['7','7 days'],['30','30 days'],['custom','Custom range']].map(([value,label])=>`<option value="${value}" ${selection.period===value?'selected':''}>${label}</option>`).join('')}</select></label></div>${selection.period==='custom'?`<form class="kpi-range" data-chart-range="${escape(context)}"><label>From (UTC)<input type="date" name="from" value="${escape(selection.draftFrom??selection.from??'')}" max="${today}" required></label><label>To (UTC)<input type="date" name="to" value="${escape(selection.draftTo??selection.to??'')}" max="${today}" required></label><button class="button primary" type="submit">Apply range</button></form>`:''}<div class="kpi-period tiny">${escape(periodLabel)} · UTC</div>`;
 if(result&&result.state!=='ready')return controls+`<div class="empty" role="status">${result.state==='loading'?'Loading graph…':result.state==='pending'?'Choose dates and apply the range.':escape(result.message||'Graph unavailable.')}${result.state==='error'?'<p><button class="button" data-action="retry-chart">Retry</button></p>':''}</div>`;
 if(series===null)return controls+`<div class="empty" role="status">${!traffic||traffic.state==='loading'?'Loading website data…':'Website data unavailable.'}${traffic&&traffic.state!=='loading'?'<p><button class="button" data-action="retry-chart">Retry</button></p>':''}</div>`;
 if(!series.length)return controls+'<p class="empty">No data available.</p>';
 const max=Math.max(1,...series.map(row=>row.value)),total=series.reduce((sum,row)=>sum+row.value,0);
 const x=i=>75+i*705/Math.max(1,series.length-1),y=value=>180-value/max*150;
 const points=series.map((row,i)=>`${x(i)},${y(row.value)}`).join(' ');
 return controls+`<div class="chart kpi-chart"><div class="chart-summary"><strong>${format(total,key)}</strong><span>${metrics[key]}</span></div><svg viewBox="0 0 800 210" role="img" aria-label="${metrics[key]} — ${escape(periodLabel)}"><g stroke="#454545" stroke-dasharray="3 4"><path d="M75 30H780M75 105H780M75 180H780"/></g><text x="0" y="34">${format(max,key)}</text><text x="0" y="184">0</text><polyline points="${points}" stroke="#efff00" stroke-width="2.5" fill="none"/>${series.map((row,i)=>`<circle cx="${x(i)}" cy="${y(row.value)}" r="4" fill="#efff00"><title>${row.day}: ${format(row.value,key)}</title></circle>`).join('')}</svg><div class="chart-dates"><span>${series[0].day}</span><span>${series.at(-1).day}</span></div><details class="kpi-values"><summary>Daily values</summary><div class="table-wrap"><table><thead><tr><th>Date (UTC)</th><th>${metrics[key]}</th></tr></thead><tbody>${series.map(row=>`<tr><td>${row.day}</td><td>${format(row.value,key)}</td></tr>`).join('')}</tbody></table></div></details></div>`;
}
