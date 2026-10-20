const metrics={pageviews:'Page hits',visits:'Website visits',tickets:'Tickets issued',conversions:'Conversions · paid orders',revenue:'Net ticket revenue',signups:'Email sign-ups',mixes:'Mix entries'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(value,key)=>key==='revenue'?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(value):Number(value).toLocaleString('en-GB');
export function kpiSeries(rows,traffic,key){
 if(!Object.hasOwn(metrics,key))return null;
 const website=['pageviews','visits'].includes(key);
 if(website&&traffic?.state!=='ready')return null;
 // Both sources use UTC days, including partial first/last days in a rolling window.
 const values=new Map((website?traffic.daily:rows).map(row=>[row.day||row.label,row[key]==null?null:Number(row[key])]));
 const start=website?traffic.range.since.slice(0,10):rows[0]?.day;
 const end=website?new Date(Date.parse(traffic.range.until)-1).toISOString().slice(0,10):rows.at(-1)?.day;
 if(!start||!end)return [];
 const result=[];
 for(let day=new Date(start+'T00:00:00Z');day.toISOString().slice(0,10)<=end;day.setUTCDate(day.getUTCDate()+1)){
  const label=day.toISOString().slice(0,10);result.push({day:label,value:values.has(label)?values.get(label):(website?null:0)});
 }
 return result;
}
export function kpiChart({rows,traffic,selected,context,selection={period:'30'},result}){
 const key=Object.hasOwn(metrics,selected)?selected:'signups',series=kpiSeries(rows,traffic,key);
 const periodLabel=selection.period==='custom'?`${selection.from} — ${selection.to}`:selection.period==='1'?'Last 24 hours':`Last ${selection.period} days`;
 const today=new Date().toISOString().slice(0,10);
 const controls=`<div class="kpi-controls"><div class="kpi-periods" role="group" aria-label="${escape(context)} graph date range">${[['1','24 hours'],['7','7 days'],['30','30 days'],['custom','Custom range']].map(([value,label])=>`<button class="button ${selection.period===value?'primary':''}" data-chart-period="${value}" aria-pressed="${selection.period===value}">${label}</button>`).join('')}</div></div>${selection.period==='custom'?`<form class="kpi-range" data-chart-range="${escape(context)}"><label>From (UTC)<input type="date" name="from" value="${escape(selection.draftFrom??selection.from??'')}" max="${today}" required></label><label>To (UTC)<input type="date" name="to" value="${escape(selection.draftTo??selection.to??'')}" max="${today}" required></label><button class="button primary" type="submit">Apply range</button></form>`:''}<div class="kpi-buttons" role="group" aria-label="${escape(context)} graph KPI">${Object.entries(metrics).map(([id,label])=>`<button class="button ${key===id?'primary':''}" data-kpi="${id}" aria-pressed="${key===id}">${({conversions:'Conversions',revenue:'Ticket revenue'})[id]||label}</button>`).join('')}</div>`;
 if(result&&result.state!=='ready')return controls+`<div class="empty" role="status">${result.state==='loading'?'Loading graph…':result.state==='pending'?'Choose dates and apply the range.':escape(result.message||'Graph unavailable.')}${result.state==='error'?'<p><button class="button" data-action="retry-chart">Retry</button></p>':''}</div>`;
 if(series===null)return controls+`<div class="empty" role="status">${!traffic||traffic.state==='loading'?'Loading website data…':'Website data unavailable.'}${traffic&&traffic.state!=='loading'?'<p><button class="button" data-action="retry-chart">Retry</button></p>':''}</div>`;
 if(!series.length)return controls+'<p class="empty">No data available.</p>';
 const website=['pageviews','visits'].includes(key),known=series.filter(row=>row.value!==null),estimated=website&&traffic.estimated,incomplete=website&&known.length<series.length;
 const quality=[estimated?'Estimate':'',incomplete?'Partial data':''].filter(Boolean).join(' · ');
 const total=series.reduce((sum,row)=>sum+row.value,0),scale=chartScale(series.map(row=>row.value));
 const left=85,right=875,top=20,bottom=265;
 const x=i=>series.length===1?(left+right)/2:left+i*(right-left)/(series.length-1),y=value=>bottom-value/scale.max*(bottom-top);
 const segments=[];let segment=[];series.forEach((row,i)=>{if(row.value===null){if(segment.length)segments.push(segment.join(' '));segment=[];}else segment.push(`${x(i)},${y(row.value)}`);});if(segment.length)segments.push(segment.join(' '));
 const indices=chartDateTicks(series.length);
 const tickFormat=value=>key==='revenue'?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(value):new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(value);
 const dateFormat=day=>new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',...(series[0].day.slice(0,4)!==series.at(-1).day.slice(0,4)?{year:'2-digit'}:{})}).format(new Date(day+'T00:00:00Z'));
 return controls+`<div class="chart kpi-chart"><div class="chart-summary"><strong>${known.length?format(total,key):'—'}</strong><span>${metrics[key]}${quality?' · '+quality:''}</span></div><div class="kpi-plot"><svg viewBox="0 0 900 305" role="img" aria-label="${metrics[key]} — ${escape(periodLabel)} (UTC)${quality?' — '+quality:''}"><g stroke="#454545" stroke-dasharray="3 4">${scale.ticks.map(value=>`<path d="M${left} ${y(value)}H${right}"/>`).join('')}${indices.map(i=>`<path d="M${x(i)} ${top}V${bottom}"/>`).join('')}</g>${scale.ticks.map(value=>`<text x="${left-14}" y="${y(value)+4}" text-anchor="end">${tickFormat(value)}</text>`).join('')}${indices.map(i=>`<text x="${x(i)}" y="${bottom+26}" text-anchor="${i===0?'start':i===series.length-1?'end':'middle'}">${dateFormat(series[i].day)}</text>`).join('')}${segments.map(points=>`<polyline points="${points}" stroke="#efff00" stroke-width="2.5" fill="none"/>`).join('')}${series.map((row,i)=>row.value===null?'':`<circle cx="${x(i)}" cy="${y(row.value)}" r="${series.length>60?2:3.5}" fill="${website&&traffic.daily.find(d=>d.label===row.day)?.estimated?'#202020':'#efff00'}" stroke="#efff00" stroke-width="1.5"><title>${row.day}: ${format(row.value,key)}${website&&traffic.daily.find(d=>d.label===row.day)?.estimated?' (estimate)':''}</title></circle>`).join('')}</svg></div></div>`;
}
// Nice, uniform increments keep the Y grid readable for zeros, counts and revenue.
export function chartScale(values){
 const peak=Math.max(1,...values),raw=peak/5,power=10**Math.floor(Math.log10(raw));
 const step=Math.max(1,([1,2,5,10].find(n=>n*power>=raw)||10)*power);
 const max=Math.max(5,Math.ceil(peak/step))*step;
 return {max,step,ticks:Array.from({length:Math.round(max/step)+1},(_,i)=>i*step)};
}
// Date ticks use a constant number of days, not rounded fractional indices.
export function chartDateTicks(length){
 if(length<=1)return [0];
 const step=Math.max(1,Math.ceil((length-1)/6));
 return Array.from({length:Math.floor((length-1)/step)+1},(_,i)=>i*step);
}
