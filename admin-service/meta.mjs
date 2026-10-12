import {createHmac} from 'node:crypto';
let cache;
export async function metaAnalytics(){
 if(cache&&cache.until>Date.now())return cache.value;
 const account=process.env.META_AD_ACCOUNT_ID,token=process.env.META_MARKETING_API_ACCESS_TOKEN,secret=process.env.META_APP_SECRET;
 if(!/^act_\d+$/.test(account||'')||!token)return {state:'not_configured'};
 const until=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const start=new Date(until+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-29);const range={since:start.toISOString().slice(0,10),until};
 const version=/^v\d+\.\d+$/.test(process.env.META_GRAPH_API_VERSION||'')?process.env.META_GRAPH_API_VERSION:'v25.0';
 const get=async(path,params)=>{const url=new URL(`https://graph.facebook.com/${version}/${account}/${path}`);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));if(secret)url.searchParams.set('appsecret_proof',createHmac('sha256',secret).update(token).digest('hex'));const r=await fetch(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});const body=await r.json();if(!r.ok||body.error){const error=new Error('Meta unavailable');error.reason=body.error?.code===190||r.status===401?'authorization':[10,200].includes(body.error?.code)||r.status===403?'permissions':r.status===429||[4,17,32,613].includes(body.error?.code)?'rate_limit':'provider';throw error;}return body;};
 try{
  // Same scope as the existing ticket admin: currently active campaigns, last 30 days.
  let campaigns=[],after;
  do{const result=await get('campaigns',{fields:'id,name',filtering:JSON.stringify([{field:'effective_status',operator:'IN',value:['ACTIVE']}]),limit:'100',...(after?{after}:{})});campaigns.push(...(result.data||[]));after=result.paging?.next?result.paging?.cursors?.after:null;}while(after&&campaigns.length<1000);
  let rows=[];after=null;
  if(campaigns.length)do{const result=await get('insights',{time_range:JSON.stringify(range),level:'campaign',filtering:JSON.stringify([{field:'campaign.id',operator:'IN',value:campaigns.map(c=>c.id)}]),fields:'campaign_id,campaign_name,spend,impressions,inline_link_clicks,date_start,date_stop',limit:'100',...(after?{after}:{})});rows.push(...(result.data||[]));after=result.paging?.next?result.paging?.cursors?.after:null;}while(after&&rows.length<1000);
  const data=campaigns.map(c=>{const r=rows.find(r=>r.campaign_id===c.id)||{};return {id:c.id,name:c.name,spend:Number(r.spend||0),impressions:Number(r.impressions||0),clicks:Number(r.inline_link_clicks||0)};});
  const all=data.reduce((a,c)=>({spend:a.spend+c.spend,impressions:a.impressions+c.impressions,clicks:a.clicks+c.clicks}),{spend:0,impressions:0,clicks:0});
  const value={state:'ready',range,all,campaigns:data};cache={value,until:Date.now()+60000};return value;
 }catch(error){return {state:'error',reason:error.reason||'unavailable'};}
}
