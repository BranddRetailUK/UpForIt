import {createHmac} from 'node:crypto';
import {hiddenMetaCampaignIds} from './meta-campaigns.mjs';
const cache=new Map(),hour=3600000;
const zero=()=>({spend:0,impressions:0,clicks:0});
// Meta supplies calendar-hour aggregates in the ad account timezone. Map them
// onto UTC hours before grouping, so UTC date filters work across DST changes.
export function aggregateMetaHours(source,range,timeZone){
 const start=Math.floor(Date.parse(range.since)/hour)*hour,end=Date.parse(range.until),short=end-start<=48*hour;
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
 const localKey=t=>{const p=Object.fromEntries(formatter.formatToParts(t).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day} ${p.hour}`;};
 const mapping=new Map(),buckets=new Map();
 for(let t=start;t<end;t+=hour){const stamp=new Date(t).toISOString(),day=short?stamp:stamp.slice(0,10),key=localKey(t);if(!buckets.has(day))buckets.set(day,{day,...zero()});if(!mapping.has(key))mapping.set(key,[]);mapping.get(key).push(day);}
 for(const r of source){if(hiddenMetaCampaignIds.has(String(r.campaign_id)))continue;const h=r.hourly_stats_aggregated_by_advertiser_time_zone?.match(/^(\d{2}):/);if(!h)throw new Error('Missing hourly breakdown');const targets=mapping.get(`${r.date_start} ${h[1]}`);if(!targets)continue;
  // During autumn DST Meta combines the repeated local hour; daily totals can
  // still be counted once, but two separate UTC hourly values cannot be inferred.
  if(new Set(targets).size>1)throw new Error('Ambiguous repeated hour');
  const b=buckets.get(targets[0]);for(const [key,field] of [['spend','spend'],['impressions','impressions'],['clicks','inline_link_clicks']]){const n=Number(r[field]||0);if(!Number.isFinite(n)||n<0)throw new Error('Invalid metric');b[key]+=n;}
 }
 const rows=[...buckets.values()],all=rows.reduce((a,r)=>{for(const key of Object.keys(a))a[key]+=r[key];return a;},zero());
 return {state:'ready',rows,all,range:{...range,since:new Date(start).toISOString()},timeZone:'UTC',precision:'hour'};
}
export async function metaSeries(range,campaignId=""){
 if(campaignId&&!/^\d+$/.test(campaignId))return {state:"error",message:"Invalid campaign."};
 const key=JSON.stringify([range.since.slice(0,13),range.until.slice(0,13),range.period,campaignId]);
 const cached=cache.get(key);if(cached&&cached.until>Date.now())return cached.value;
 const account=process.env.META_AD_ACCOUNT_ID,token=process.env.META_MARKETING_API_ACCESS_TOKEN,secret=process.env.META_APP_SECRET;
 if(!/^act_\d+$/.test(account||'')||!token)return {state:'not_configured'};
 const version=/^v\d+\.\d+$/.test(process.env.META_GRAPH_API_VERSION||'')?process.env.META_GRAPH_API_VERSION:'v25.0';
 const get=async(path,params)=>{const url=new URL(`https://graph.facebook.com/${version}/${account}${path}`);for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);if(secret)url.searchParams.set('appsecret_proof',createHmac('sha256',secret).update(token).digest('hex'));const response=await fetch(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});const body=await response.json();if(!response.ok||body.error)throw new Error('Meta unavailable');return body;};
 try{
  const info=await get('',{fields:'timezone_name'}),zone=info.timezone_name;if(!zone)throw new Error('Missing timezone');
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
  const time_range=JSON.stringify({since:date.format(new Date(range.since)),until:date.format(new Date(Date.parse(range.until)-1))});
  const rows=[];let after;const seen=new Set();
  do{const response=await get('/insights',{fields:'campaign_id,date_start,spend,impressions,inline_link_clicks',level:'campaign',...(campaignId?{filtering:JSON.stringify([{field:'campaign.id',operator:'IN',value:[campaignId]}])}:{}),time_range,time_increment:'1',breakdowns:'hourly_stats_aggregated_by_advertiser_time_zone',limit:'500',...(after?{after}:{})});rows.push(...(response.data||[]));after=response.paging?.next?response.paging.cursors?.after:null;if(response.paging?.next&&(!after||seen.has(after)||seen.size>=100))throw new Error('Incomplete report');if(after)seen.add(after);}while(after);
  const value=aggregateMetaHours(campaignId?rows.filter(r=>r.campaign_id===campaignId):rows,range,zone);cache.set(key,{value,until:Date.now()+60000});if(cache.size>24)cache.delete(cache.keys().next().value);return value;
 }catch{return {state:'error',message:'Meta graph unavailable for this range. Please retry.'};}
}
