import {visibleMetaCampaigns} from './meta-campaigns.mjs';
import {createHmac} from 'node:crypto';
const cache=new Map();
export async function metaAnalytics(campaignId=""){
 if(campaignId&&!/^\d+$/.test(campaignId))return {state:"error",reason:"invalid_campaign"};
 const cached=cache.get(campaignId);
 if(cached&&cached.until>Date.now())return cached.value;
 const account=process.env.META_AD_ACCOUNT_ID,token=process.env.META_MARKETING_API_ACCESS_TOKEN,secret=process.env.META_APP_SECRET;
 if(!/^act_\d+$/.test(account||'')||!token)return {state:'not_configured'};
 const until=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const start=new Date(until+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-29);const range={since:start.toISOString().slice(0,10),until};
 const version=/^v\d+\.\d+$/.test(process.env.META_GRAPH_API_VERSION||'')?process.env.META_GRAPH_API_VERSION:'v25.0';
 const get=async(path,params)=>{const url=new URL(`https://graph.facebook.com/${version}/${account}/${path}`);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));if(secret)url.searchParams.set('appsecret_proof',createHmac('sha256',secret).update(token).digest('hex'));const r=await fetch(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});const body=await r.json();if(!r.ok||body.error){const error=new Error('Meta unavailable');error.reason=body.error?.code===190||r.status===401?'authorization':[10,200].includes(body.error?.code)||r.status===403?'permissions':r.status===429||[4,17,32,613].includes(body.error?.code)?'rate_limit':'provider';throw error;}return body;};
 try{
  // Read lifecycle states, then exclude the retired campaigns before requesting metrics.
  let campaigns=[],after;
  do{const result=await get('campaigns',{fields:'id,name,status,effective_status',limit:'100',...(after?{after}:{})});campaigns.push(...(result.data||[]));after=result.paging?.next?result.paging?.cursors?.after:null;}while(after&&campaigns.length<1000);
  campaigns=visibleMetaCampaigns(campaigns);
  const campaignOptions=campaigns.filter(c=>(c.effective_status||c.status)==='ACTIVE');
  if(campaignId)campaigns=campaigns.filter(c=>c.id===campaignId);
  const ids=new Set(campaigns.map(c=>c.id));
  const insights=async(breakdowns,level="campaign")=>{
   if(!campaigns.length)return [];
   const rows=[];let cursor;const seen=new Set();
   do{
    const result=await get('insights',{time_range:JSON.stringify(range),level,filtering:JSON.stringify([{field:'campaign.id',operator:'IN',value:[...ids]}]),fields:(level==='ad'?'ad_id,':'')+'campaign_id,spend,impressions,inline_link_clicks,outbound_clicks,actions',limit:'500',...(breakdowns?{breakdowns}:{}),...(cursor?{after:cursor}:{})});
    rows.push(...(result.data||[]).filter(r=>ids.has(r.campaign_id)));
    cursor=result.paging?.next?result.paging?.cursors?.after:null;
    if(result.paging?.next&&(!cursor||seen.has(cursor)||seen.size>=100))throw new Error('Incomplete Meta report');
    if(cursor)seen.add(cursor);
   }while(cursor);
   return rows;
  };
  const metrics=r=>({spend:Number(r.spend||0),impressions:Number(r.impressions||0),clicks:Number(r.inline_link_clicks||0),outboundClicks:Number(r.outbound_clicks?.find(a=>a.action_type==='outbound_click')?.value||0),landingViews:Number(r.actions?.find(a=>a.action_type==='landing_page_view')?.value||0)});
  const zero=()=>({spend:0,impressions:0,clicks:0,outboundClicks:0,landingViews:0});
  const add=(a,b)=>{for(const k of Object.keys(a))a[k]+=b[k];return a;};
  const rows=await insights();
  const data=campaigns.map(c=>({id:c.id,name:c.name,status:c.effective_status||c.status||'UNKNOWN',...rows.filter(r=>r.campaign_id===c.id).reduce((a,r)=>add(a,metrics(r)),zero())}));
  const all=data.reduce((a,c)=>add(a,c),zero());
  const breakdowns=Object.fromEntries(await Promise.all([
   ['placements','publisher_platform,platform_position'],['devices','impression_device'],['countries','country']
  ].map(async([key,fields])=>{
   try{
    const groups=new Map();
    for(const r of await insights(fields)){
     const dimensions=fields.split(',').map(f=>r[f]||'unknown'),id=JSON.stringify(dimensions);
     if(!groups.has(id))groups.set(id,{dimensions,...zero()});
     const group=groups.get(id),m=metrics(r);for(const k of Object.keys(m))group[k]+=m[k];
    }
    return [key,{state:'ready',rows:[...groups.values()].sort((a,b)=>b.clicks-a.clicks||b.impressions-a.impressions)}];
   }catch(error){return [key,{state:'error',reason:error.reason||'unavailable'}];}
  })));
  let ads={state:'ready',rows:[]};
  try{
   const inventory=[];let cursor;const seen=new Set();
   if(ids.size)do{
    const result=await get('ads',{fields:'id,name,status,effective_status,campaign_id,adset{start_time,end_time,promoted_object}',filtering:JSON.stringify([{field:'campaign.id',operator:'IN',value:[...ids]}]),limit:'100',...(cursor?{after:cursor}:{})});
    inventory.push(...(result.data||[]).filter(a=>ids.has(a.campaign_id)));
    cursor=result.paging?.next?result.paging?.cursors?.after:null;
    if(result.paging?.next&&(!cursor||seen.has(cursor)||seen.size>=100))throw new Error('Incomplete Meta ads');
    if(cursor)seen.add(cursor);
   }while(cursor);
   const adMetrics=await insights(null,'ad');
   ads.rows=inventory.map(a=>({id:a.id,name:a.name,campaignId:a.campaign_id,campaignName:campaigns.find(c=>c.id===a.campaign_id)?.name||'',status:a.effective_status||a.status||'UNKNOWN',startTime:a.adset?.start_time,endTime:a.adset?.end_time,pixelId:a.adset?.promoted_object?.pixel_id||null,...adMetrics.filter(r=>r.ad_id===a.id).reduce((sum,r)=>add(sum,metrics(r)),zero())}));
  }catch(error){ads={state:'error',reason:error.reason||'unavailable'};}
  const value={state:'ready',range,all,campaigns:data,campaignOptions,breakdowns,ads};cache.set(campaignId,{value,until:Date.now()+60000});if(cache.size>50)cache.delete(cache.keys().next().value);return value;
 }catch(error){return {state:'error',reason:error.reason||'unavailable'};}
}
