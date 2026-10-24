const chartRenderers=new Map(),chartObservers=new Map();
const periods=[['mtd','Month to date'],['today','Today'],['yesterday','Yesterday'],['1','24 hours'],['7','7 days'],['14','14 days'],['30','30 days'],['90','90 days'],['lastmonth','Last month'],['ytd','Year to date'],['custom','Custom range']];
const metrics={spend:'Amount spent',impressions:'Impressions',clicks:'Link clicks',pageviews:'Page hits',visits:'Website visits',tickets:'Tickets issued',conversions:'Sales · paid orders',revenue:'Net ticket revenue',signups:'Email sign-ups',mixes:'Mix entries'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(value,key)=>['revenue','spend'].includes(key)?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(value):Number(value).toLocaleString('en-GB');
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
const cardIcons={pageviews:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',conversions:'<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Z"/>',revenue:'<path d="M17 6c0-5-9-5-9 1v13M5 12h10M5 20h14"/>',impressions:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',clicks:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>'};
const cardTop=(label,id)=>`<span class="stat-top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cardIcons[id]}</svg><span>${label}</span></span>`;
export function kpiCards({rows,traffic,selected,context,result,meta,adSeries,campaignOnly=false}){
 const labels=campaignOnly?{}:context==='analytics'?{pageviews:'Page hits',conversions:'Sales',revenue:'Revenue'}:{pageviews:'Page hits',tickets:'Tickets issued',conversions:'Sales',revenue:'Revenue',signups:'Email sign-ups',mixes:'Mix entries'};
 return `<section class="kpi-cards" aria-label="${escape(context)} performance metrics">${Object.entries(labels).map(([id,label])=>{
  const series=kpiSeries(rows,traffic,id),ready=(!result||result.state==='ready')&&series?.some(row=>row.value!==null);
  const total=ready?format(series.reduce((sum,row)=>sum+(row.value||0),0),id):'—';
  const detail=id==='pageviews'&&traffic?.incomplete?'Recorded hits only; earlier dates are unavailable.':id==='revenue'?'Ticket revenue after refunds.':id==='conversions'?'Paid ticket orders.':'Total for the selected date range.';
  return `<button type="button" class="kpi-card ${selected===id?'active':''}" data-kpi="${id}" aria-pressed="${selected===id}" title="${detail}">${context==='analytics'?cardTop(label,id):`<span class="kpi-card-label">${label}</span>`}<strong class="kpi-card-value">${total}</strong></button>`;
 }).join('')}${context==='analytics'?['spend','impressions','clicks'].map(id=>`<button type="button" class="kpi-card ${selected===id?'active':''}" data-kpi="${id}" aria-pressed="${selected===id}" title="Meta totals for the selected range, reported in whole hours.">${cardTop(metrics[id],id==='spend'?'revenue':id)}<strong class="kpi-card-value">${adSeries?.state==='ready'?format(adSeries.all[id],id):'—'}</strong></button>`).join(''):''}</section>`;
}
export function kpiPeriodControl(context,selection){return `<select data-chart-period aria-label="${escape(context)} graph date range">${periods.map(([value,label])=>`<option value="${value}" ${selection.period===value?'selected':''}>${label}</option>`).join('')}</select>`;}
export function kpiChart({rows,traffic,selected,context,selection={period:'30'},result,adSeries,renderWidth}){
 if(!renderWidth)chartRenderers.set(context,width=>kpiChart({rows,traffic,selected,context,selection,result,adSeries,renderWidth:width}));
 const key=Object.hasOwn(metrics,selected)?selected:'signups',isAd=['spend','impressions','clicks'].includes(key),series=isAd?(adSeries?.state==='ready'?kpiSeries(adSeries.rows,null,key):null):kpiSeries(rows,traffic,key);
 const periodLabel=selection.period==='custom'?`${selection.from} — ${selection.to}`:periods.find(([id])=>id===selection.period)?.[1]||'Selected range';
 const today=new Date().toISOString().slice(0,10);
 const controls=`${selection.period==='custom'?`<form class="kpi-range" data-chart-range="${escape(context)}"><label>From (UTC)<input type="date" name="from" value="${escape(selection.draftFrom??selection.from??'')}" max="${today}" required></label><label>To (UTC)<input type="date" name="to" value="${escape(selection.draftTo??selection.to??'')}" max="${today}" required></label><button class="button primary" type="submit">Apply range</button></form>`:''}`;
 if(result&&result.state!=='ready')return controls+`<div class="empty" role="status">${result.state==='loading'?'Loading graph…':result.state==='pending'?'Choose dates and apply the range.':escape(result.message||'Graph unavailable.')}${result.state==='error'?'<p><button class="button" data-action="retry-chart">Retry</button></p>':''}</div>`;
 if(isAd&&adSeries?.state!=='ready')return controls+`<div class="empty" role="status">${escape(adSeries?.message||'Meta graph unavailable.')}<p><button class="button" data-action="retry-chart">Retry</button></p></div>`;
 if(series===null)return controls+`<div class="empty" role="status">${!traffic||traffic.state==='loading'?'Loading website data…':'Website data unavailable.'}${traffic&&traffic.state!=='loading'?'<p><button class="button" data-action="retry-chart">Retry</button></p>':''}</div>`;
 if(!series.length)return controls+'<p class="empty">No data available.</p>';
 const website=['pageviews','visits'].includes(key),known=series.filter(row=>row.value!==null);
 if(website&&!known.length)return controls+'<p class="empty" role="status">No recorded traffic for this range. Direct tracking had not started yet.</p>';
 const scale=chartScale(series.map(row=>row.value));
 const width=renderWidth||Math.max(640,series.length*42+80),left=65,right=width-20,top=20,bottom=245;
 const x=i=>series.length===1?(left+right)/2:left+i*(right-left)/(series.length-1),y=value=>bottom-value/scale.max*(bottom-top);
 const segments=[];let segment=[];series.forEach((row,i)=>{if(row.value===null){if(segment.length)segments.push(segment.join(' '));segment=[];}else segment.push(`${x(i)},${y(row.value)}`);});if(segment.length)segments.push(segment.join(' '));
 const indices=chartDateTicks(series.length),hourly=series[0].day.includes('T');
 const tickFormat=value=>['revenue','spend'].includes(key)?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(value):new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(value);
 const dateFormat=day=>hourly?day.slice(11,16):series.length>14?String(Number(day.slice(8,10))):new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',...(series[0].day.slice(0,4)!==series.at(-1).day.slice(0,4)?{year:'2-digit'}:{})}).format(new Date(day+'T00:00:00Z'));
 return controls+`<div class="chart kpi-chart" data-chart-context="${context}" data-points="${series.length}"><div class="kpi-plot"><svg preserveAspectRatio="xMidYMid meet" style="width:${width}px;min-width:${width}px;height:285px" viewBox="0 0 ${width} 285" role="img" aria-label="${metrics[key]} — ${escape(periodLabel)} (UTC)"><defs><linearGradient id="area-${context}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#efff00" stop-opacity=".22"/><stop offset="100%" stop-color="#efff00" stop-opacity="0"/></linearGradient></defs><g stroke="#383838" stroke-dasharray="3 4">${scale.ticks.map(value=>`<path d="M${left} ${y(value)}H${right}"/>`).join('')}</g>${scale.ticks.map(value=>`<text x="${left-14}" y="${y(value)+4}" text-anchor="end">${tickFormat(value)}</text>`).join('')}${indices.map(i=>`<text x="${x(i)}" y="${bottom+26}" text-anchor="${i===0?'start':i===series.length-1?'end':'middle'}">${dateFormat(series[i].day)}</text>`).join('')}${segments.map(points=>`<polygon points="${points.split(' ')[0].split(',')[0]},${bottom} ${points} ${points.split(' ').at(-1).split(',')[0]},${bottom}" fill="url(#area-${context})"/>`).join('')}${segments.map(points=>`<polyline points="${points}" stroke="#efff00" stroke-width="2" vector-effect="non-scaling-stroke" fill="none"/>`).join('')}${series.map((row,i)=>row.value===null?'':`<circle cx="${x(i)}" cy="${y(row.value)}" r="3" fill="#efff00" stroke="#efff00" stroke-width="1.5"></circle>`).join('')}${series.map((row,i)=>{const sales=rows.find(r=>r.day===row.day);const detail=row.value===null?'Not recorded':format(row.value,key);const extra=['conversions','revenue'].includes(key)&&sales?` · Sales: ${format(sales.conversions,'conversions')} · Revenue: ${format(sales.revenue,'revenue')}`:'';return `<rect class="kpi-hit" x="${x(i)-Math.min(30,Math.max(12,(right-left)/Math.max(1,series.length-1)/2))}" y="${top}" width="${Math.min(60,Math.max(24,(right-left)/Math.max(1,series.length-1)))}" height="${bottom-top}" fill="transparent" data-detail="${escape(row.day+' · '+metrics[key]+': '+detail+extra+(isAd?' · Meta hourly reporting':''))}" tabindex="${i===0?0:-1}" aria-label="${escape(row.day+': '+detail+extra)}"/>`;}).join('')}</svg></div><div class="kpi-tooltip" role="tooltip" hidden></div><span class="sr-only kpi-announcement" aria-live="polite"></span></div>`;
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
  const points=[...plot.querySelectorAll('.kpi-hit')],tooltip=plot.querySelector('.kpi-tooltip'),announcement=plot.querySelector('.kpi-announcement');
  const hide=()=>{tooltip.hidden=true;for(const p of points)p.classList.remove('active');};
  const show=(point,event)=>{
   for(const p of points)p.classList.toggle('active',p===point);
   const parts=point.dataset.detail.split(' · '),stamp=parts.shift();
   const dateLabel=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric',...(stamp.includes('T')?{hour:'2-digit',minute:'2-digit'}:{})}).format(new Date(stamp));
   tooltip.replaceChildren();const heading=document.createElement('strong');heading.textContent=dateLabel+' UTC';tooltip.append(heading);
   const value=document.createElement('span');value.textContent=parts.join(' · ');tooltip.append(value);tooltip.hidden=false;
   if(!event)announcement.textContent=point.dataset.detail;
   const rect=point.getBoundingClientRect(),x=event?.clientX??rect.left+rect.width/2,y=event?.clientY??rect.top+40;
   const w=tooltip.offsetWidth,h=tooltip.offsetHeight;
   tooltip.style.left=Math.max(8,Math.min(x+16,window.innerWidth-w-8))+'px';
   tooltip.style.top=Math.max(8,y+18+h>window.innerHeight?y-h-12:y+18)+'px';
  };
  plot.onpointerleave=hide;plot.onfocusout=event=>{if(!plot.contains(event.relatedTarget))hide();};plot.querySelector('.kpi-plot').onscroll=hide;
  points.forEach((point,i)=>{
   point.onpointerenter=event=>show(point,event);point.onpointermove=event=>show(point,event);point.onfocus=()=>show(point);point.onblur=hide;
   point.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Escape'].includes(event.key))return;event.preventDefault();if(event.key==='Escape'){hide();point.blur();return;}const next=points[Math.max(0,Math.min(points.length-1,i+(event.key==='ArrowRight'?1:-1)))];point.setAttribute('tabindex','-1');next.setAttribute('tabindex','0');next.focus();};
  });
  };
  const container=plot.querySelector('.kpi-plot'),draw=chartRenderers.get(plot.dataset.chartContext);
  let lastWidth=0;
  const resize=()=>{const width=Math.round(Math.max(640,Number(plot.dataset.points)*32+80,container.clientWidth));if(width===lastWidth)return;lastWidth=width;const template=document.createElement('template');template.innerHTML=draw(width);container.replaceChildren(template.content.querySelector('svg'));bindPoints();};
  resize();
  const observer=new ResizeObserver(resize);observer.observe(container);chartObservers.set(plot.dataset.chartContext,observer);
 }
}
