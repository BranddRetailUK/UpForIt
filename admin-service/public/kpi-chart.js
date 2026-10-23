const chartRenderers=new Map(),chartObservers=new Map();
const periods=[['mtd','Month to date'],['today','Today'],['yesterday','Yesterday'],['1','24 hours'],['7','7 days'],['14','14 days'],['30','30 days'],['90','90 days'],['lastmonth','Last month'],['ytd','Year to date'],['custom','Custom range']];
const metrics={pageviews:'Page hits',visits:'Website visits',tickets:'Tickets issued',conversions:'Sales · paid orders',revenue:'Net ticket revenue',signups:'Email sign-ups',mixes:'Mix entries'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(value,key)=>key==='revenue'?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(value):Number(value).toLocaleString('en-GB');
export function kpiSeries(rows,traffic,key){
 if(!Object.hasOwn(metrics,key))return null;
 const website=['pageviews','visits'].includes(key);
 if(website&&traffic?.state!=='ready')return null;
 // Short ranges contain complete hourly buckets from the server.
 const source=website?traffic.daily:rows;
 if(source?.[0]&&(source[0].day||source[0].label).includes('T'))return source.map(row=>({day:row.day||row.label,value:row[key]==null?null:Number(row[key])}));
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
export function kpiCards({rows,traffic,selected,context,result}){
 const labels={pageviews:'Page hits',tickets:'Tickets issued',conversions:'Sales',revenue:'Revenue',signups:'Email sign-ups',mixes:'Mix entries'};
 return `<section class="kpi-cards" aria-label="${escape(context)} performance metrics">${Object.entries(labels).map(([id,label])=>{
  const series=kpiSeries(rows,traffic,id),ready=(!result||result.state==='ready')&&series?.some(row=>row.value!==null);
  const total=ready?format(series.reduce((sum,row)=>sum+(row.value||0),0),id):'—';
  const detail=id==='pageviews'&&traffic?.incomplete?'Recorded hits only; earlier dates are unavailable.':id==='revenue'?'Ticket revenue after refunds.':id==='conversions'?'Paid ticket orders.':'Total for the selected date range.';
  return `<button type="button" class="kpi-card ${selected===id?'active':''}" data-kpi="${id}" aria-pressed="${selected===id}" title="${detail}"><span class="kpi-card-label">${label}</span><strong class="kpi-card-value">${total}</strong></button>`;
 }).join('')}</section>`;
}
export function kpiChart({rows,traffic,selected,context,selection={period:'30'},result,renderWidth}){
 if(!renderWidth)chartRenderers.set(context,width=>kpiChart({rows,traffic,selected,context,selection,result,renderWidth:width}));
 const key=Object.hasOwn(metrics,selected)?selected:'signups',series=kpiSeries(rows,traffic,key);
 const periodLabel=selection.period==='custom'?`${selection.from} — ${selection.to}`:periods.find(([id])=>id===selection.period)?.[1]||'Selected range';
 const today=new Date().toISOString().slice(0,10);
 const controls=`<div class="kpi-header"><div class="kpi-controls"><select data-chart-period aria-label="${escape(context)} graph date range">${periods.map(([value,label])=>`<option value="${value}" ${selection.period===value?'selected':''}>${label}</option>`).join('')}</select></div>${selection.period==='custom'?`<form class="kpi-range" data-chart-range="${escape(context)}"><label>From (UTC)<input type="date" name="from" value="${escape(selection.draftFrom??selection.from??'')}" max="${today}" required></label><label>To (UTC)<input type="date" name="to" value="${escape(selection.draftTo??selection.to??'')}" max="${today}" required></label><button class="button primary" type="submit">Apply range</button></form>`:''}</div>`;
 if(result&&result.state!=='ready')return controls+`<div class="empty" role="status">${result.state==='loading'?'Loading graph…':result.state==='pending'?'Choose dates and apply the range.':escape(result.message||'Graph unavailable.')}${result.state==='error'?'<p><button class="button" data-action="retry-chart">Retry</button></p>':''}</div>`;
 if(series===null)return controls+`<div class="empty" role="status">${!traffic||traffic.state==='loading'?'Loading website data…':'Website data unavailable.'}${traffic&&traffic.state!=='loading'?'<p><button class="button" data-action="retry-chart">Retry</button></p>':''}</div>`;
 if(!series.length)return controls+'<p class="empty">No data available.</p>';
 const website=['pageviews','visits'].includes(key),known=series.filter(row=>row.value!==null),incomplete=website&&(traffic.incomplete||known.length<series.length);
 if(website&&!known.length)return controls+'<p class="empty" role="status">No recorded traffic for this range. Direct tracking had not started yet.</p>';
 const quality=incomplete?'Partial data · tracking began during this range':'';
 const scale=chartScale(series.map(row=>row.value));
 const width=renderWidth||Math.max(640,series.length*42+80),left=65,right=width-20,top=20,bottom=245;
 const x=i=>series.length===1?(left+right)/2:left+i*(right-left)/(series.length-1),y=value=>bottom-value/scale.max*(bottom-top);
 const segments=[];let segment=[];series.forEach((row,i)=>{if(row.value===null){if(segment.length)segments.push(segment.join(' '));segment=[];}else segment.push(`${x(i)},${y(row.value)}`);});if(segment.length)segments.push(segment.join(' '));
 const indices=chartDateTicks(series.length),hourly=series[0].day.includes('T');
 const tickFormat=value=>key==='revenue'?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(value):new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(value);
 const dateFormat=day=>hourly?day.slice(11,16):series.length>14?String(Number(day.slice(8,10))):new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',...(series[0].day.slice(0,4)!==series.at(-1).day.slice(0,4)?{year:'2-digit'}:{})}).format(new Date(day+'T00:00:00Z'));
 return controls+`<div class="chart kpi-chart" data-chart-context="${context}" data-points="${series.length}"><div class="kpi-quality">${quality}</div><div class="kpi-plot"><svg preserveAspectRatio="xMidYMid meet" style="width:${width}px;min-width:${width}px;height:285px" viewBox="0 0 ${width} 285" role="img" aria-label="${metrics[key]} — ${escape(periodLabel)} (UTC)${quality?' — '+quality:''}"><defs><linearGradient id="area-${context}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#efff00" stop-opacity=".22"/><stop offset="100%" stop-color="#efff00" stop-opacity="0"/></linearGradient></defs><g stroke="#383838" stroke-dasharray="3 4">${scale.ticks.map(value=>`<path d="M${left} ${y(value)}H${right}"/>`).join('')}</g>${scale.ticks.map(value=>`<text x="${left-14}" y="${y(value)+4}" text-anchor="end">${tickFormat(value)}</text>`).join('')}${indices.map(i=>`<text x="${x(i)}" y="${bottom+26}" text-anchor="${i===0?'start':i===series.length-1?'end':'middle'}">${dateFormat(series[i].day)}</text>`).join('')}${segments.map(points=>`<polygon points="${points.split(' ')[0].split(',')[0]},${bottom} ${points} ${points.split(' ').at(-1).split(',')[0]},${bottom}" fill="url(#area-${context})"/>`).join('')}${segments.map(points=>`<polyline points="${points}" stroke="#efff00" stroke-width="2" vector-effect="non-scaling-stroke" fill="none"/>`).join('')}${series.map((row,i)=>row.value===null?'':`<circle cx="${x(i)}" cy="${y(row.value)}" r="3" fill="#efff00" stroke="#efff00" stroke-width="1.5"><title>${row.day}: ${format(row.value,key)}</title></circle>`).join('')}${series.map((row,i)=>{const sales=rows.find(r=>r.day===row.day);const detail=row.value===null?'Not recorded':format(row.value,key);const extra=['conversions','revenue'].includes(key)&&sales?` · Sales: ${format(sales.conversions,'conversions')} · Revenue: ${format(sales.revenue,'revenue')}`:'';return `<rect class="kpi-hit" x="${x(i)-Math.min(30,Math.max(12,(right-left)/Math.max(1,series.length-1)/2))}" y="${top}" width="${Math.min(60,Math.max(24,(right-left)/Math.max(1,series.length-1)))}" height="${bottom-top}" fill="transparent" data-detail="${escape(row.day+' · '+metrics[key]+': '+detail+extra)}" tabindex="${i===0?0:-1}" aria-label="${escape(row.day+': '+detail+extra)}"/>`;}).join('')}</svg></div><div class="kpi-inspector" aria-live="polite">Hover or focus the graph to inspect a date. Use arrow keys to move.</div></div>`;
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

export function bindKpiCharts(root=document){
 for(const observer of chartObservers.values())observer.disconnect();
 chartObservers.clear();
 for(const plot of root.querySelectorAll('.kpi-chart')){
  const bindPoints=()=>{
  const points=[...plot.querySelectorAll('.kpi-hit')],inspector=plot.querySelector('.kpi-inspector');
  const show=point=>{for(const p of points)p.classList.toggle('active',p===point);inspector.textContent=point.dataset.detail;};
  points.forEach((point,i)=>{
   point.onpointerenter=()=>show(point);point.onfocus=()=>show(point);
   point.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Escape'].includes(event.key))return;event.preventDefault();if(event.key==='Escape'){point.blur();return;}const next=points[Math.max(0,Math.min(points.length-1,i+(event.key==='ArrowRight'?1:-1)))];point.setAttribute('tabindex','-1');next.setAttribute('tabindex','0');next.focus();};
  });
  };
  const container=plot.querySelector('.kpi-plot'),draw=chartRenderers.get(plot.dataset.chartContext);
  let lastWidth=0;
  const resize=()=>{const width=Math.round(Math.max(640,Number(plot.dataset.points)*32+80,container.clientWidth));if(width===lastWidth)return;lastWidth=width;const template=document.createElement('template');template.innerHTML=draw(width);container.replaceChildren(template.content.querySelector('svg'));bindPoints();};
  resize();
  const observer=new ResizeObserver(resize);observer.observe(container);chartObservers.set(plot.dataset.chartContext,observer);
 }
}
