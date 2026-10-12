// Browser page loads from Cloudflare Web Analytics, not CDN asset/request counts.
// Secrets stay on the server; no IP addresses or individual visitor records are fetched.
const dimensions = {daily:'date',pages:'requestPath',landings:'requestPath'};
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function createTrafficAnalytics({env=process.env,fetcher=fetch,now=()=>new Date()}={}) {
  const cache=new Map(),pending=new Map();
  return async function trafficAnalytics(days=7) {
    if(![1,7,30].includes(days))return {state:'error',reason:'invalid_range'};
    const token=env.CLOUDFLARE_ANALYTICS_API_TOKEN?.trim(),account=env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const hosts=(env.CLOUDFLARE_ANALYTICS_HOSTS||'upforitevents.co.uk,www.upforitevents.co.uk').split(',').map(h=>h.trim()).filter(Boolean);
    if(!token||!account)return {state:'not_configured'};
    if(!/^[a-f0-9]{32}$/i.test(account)||!hosts.length||hosts.some(h=>!/^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(h)))return {state:'error',reason:'configuration'};
    if(cache.get(days)?.until>Date.now())return cache.get(days).value;
    if(pending.has(days))return pending.get(days);
    const task=(async()=>{
      const end=now(),start=new Date(end.getTime()-days*86400000);
      const range={since:start.toISOString(),until:end.toISOString(),days};
      const filter={datetime_geq:range.since,datetime_lt:range.until,OR:hosts.map(requestHost=>({requestHost}))};
      const groups=Object.entries(dimensions).map(([name,dimension])=>`${name}: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: ${name==='daily'?32:10}, orderBy: [${name==='daily'?'date_ASC':name==='landings'?'sum_visits_DESC':'count_DESC'}]) { count sum { visits } dimensions { label: ${dimension} } }`).join('\n');
      const query=`query Traffic($account: String!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
        viewer { accounts(filter: {accountTag: $account}) {
          total: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) { count sum { visits } }
          ${groups}
        } }
      }`;
      try {
        const response=await fetcher('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{account,filter}}),signal:AbortSignal.timeout(12000)});
        const payload=await response.json();
        if(!response.ok||payload.errors?.length){
          const messages=JSON.stringify(payload.errors||[]);
          const reason=[401,403].includes(response.status)||/auth|permission|access denied/i.test(messages)?'authorization':response.status===429||/rate limit/i.test(messages)?'rate_limit':'provider';
          return {state:'error',reason};
        }
        const data=payload.data?.viewer?.accounts?.[0];
        if(!data||!Array.isArray(data.total)||Object.keys(dimensions).some(key=>!Array.isArray(data[key])))return {state:'error',reason:'provider'};
        const metrics=row=>({pageviews:number(row?.count),visits:number(row?.sum?.visits)});
        const value={state:'ready',range,hosts,updatedAt:end.toISOString(),...metrics(data.total[0]),...Object.fromEntries(Object.keys(dimensions).map(key=>[key,data[key].map(row=>({label:String(row.dimensions?.label|| (key==='referrers'?'Direct / unknown':'Unknown')).split('?')[0].slice(0,250),...metrics(row)}))]))};
        cache.set(days,{until:Date.now()+60000,value});
        return value;
      }catch{return {state:'error',reason:'unavailable'};}
    })();
    pending.set(days,task);
    try{return await task;}finally{pending.delete(days);}
  };
}
export const trafficAnalytics=createTrafficAnalytics();
