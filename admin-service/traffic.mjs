// Browser page loads from Cloudflare Web Analytics, not CDN asset/request counts.
// Secrets stay on the server; no IP addresses or individual visitor records are fetched.
const dimensions = {daily:'date',pages:'requestPath',landings:'requestPath'};
const number = value => value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;

export function createTrafficAnalytics({env=process.env,fetcher=fetch,now=()=>new Date()}={}) {
  const cache=new Map(),pending=new Map();
  return async function trafficAnalytics(days=7) {
    const custom=typeof days==='object'&&days!==null;
    if(custom?(!Number.isFinite(Date.parse(days.since))||!Number.isFinite(Date.parse(days.until))||Date.parse(days.until)<=Date.parse(days.since)||Date.parse(days.until)-Date.parse(days.since)>366*86400000):![1,7,30].includes(days))return {state:'error',reason:'invalid_range'};
    const token=env.CLOUDFLARE_ANALYTICS_API_TOKEN?.trim(),account=env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const hosts=(env.CLOUDFLARE_ANALYTICS_HOSTS||'upforitevents.co.uk,www.upforitevents.co.uk').split(',').map(h=>h.trim()).filter(Boolean);
    if(!token||!account)return {state:'not_configured'};
    if(!/^[a-f0-9]{32}$/i.test(account)||!hosts.length||hosts.some(h=>!/^([a-z0-9-]+\.)+[a-z0-9-]+$/i.test(h)))return {state:'error',reason:'configuration'};
    const key=custom?days.since+'|'+days.until:days;
    if(cache.get(key)?.until>Date.now())return cache.get(key).value;
    if(pending.has(key))return pending.get(key);
    const task=(async()=>{
      const end=custom?new Date(days.until):now(),start=custom?new Date(days.since):new Date(end.getTime()-days*86400000);
      const range={since:start.toISOString(),until:end.toISOString(),days:(end-start)/86400000};
      const filter={datetime_geq:range.since,datetime_lt:range.until,OR:hosts.map(requestHost=>({requestHost}))};
      const groups=Object.entries(dimensions).map(([name,dimension])=>`${name}: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: ${name==='daily'?367:10}, orderBy: [${name==='daily'?'date_ASC':name==='landings'?'sum_visits_DESC':'count_DESC'}]) { count avg { sampleInterval } sum { visits } dimensions { label: ${dimension} } }`).join('\n');
      const query=`query Traffic($account: String!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!) {
        viewer { accounts(filter: {accountTag: $account}) {
          total: rumPageloadEventsAdaptiveGroups(filter: $filter, limit: 1) { count avg { sampleInterval } sum { visits } }
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
        const metrics=row=>({pageviews:number(row?.count),visits:number(row?.sum?.visits),sampleInterval:Number(row?.avg?.sampleInterval)||null,estimated:!row?.avg?.sampleInterval||Number(row.avg.sampleInterval)>1});
        // Each UTC day gets its own filter so old sampled history cannot lower
        // the resolution of recent days. Seven aliases per request; three requests at a time.
        const windows=[];
        for(let cursor=new Date(start);cursor<end;){
          const stop=new Date(Math.min(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth(),cursor.getUTCDate()+1),end.getTime()));
          windows.push({label:cursor.toISOString().slice(0,10),since:cursor.toISOString(),until:stop.toISOString()});cursor=stop;
        }
        let daily=[];
        if(end-start<=86400000)daily=data.daily.filter(row=>number(row.count)!==null).map(row=>({label:row.dimensions.label,...metrics(row)}));
        else{
          const batches=Array.from({length:Math.ceil(windows.length/7)},(_,i)=>windows.slice(i*7,i*7+7));
          let next=0;
          await Promise.all(Array.from({length:Math.min(3,batches.length)},async()=>{
            while(next<batches.length){
              const batch=batches[next++],variables={account},declarations=['$account: String!'];
              const nodes=batch.map((window,i)=>{
                declarations.push(`$f${i}: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!`);
                variables['f'+i]={...filter,datetime_geq:window.since,datetime_lt:window.until};
                return `d${i}: rumPageloadEventsAdaptiveGroups(filter:$f${i},limit:1) { count avg { sampleInterval } sum { visits } }`;
              });
              try{
                const r=await fetcher('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:`query Daily(${declarations.join(',')}) { viewer { accounts(filter:{accountTag:$account}) { ${nodes.join(' ')} } } }`,variables}),signal:AbortSignal.timeout(12000)});
                const p=await r.json(),accountData=p.data?.viewer?.accounts?.[0];
                if(r.ok&&!p.errors?.length&&accountData)batch.forEach((window,i)=>{const row=accountData['d'+i]?.[0];if(row&&number(row.count)!==null)daily.push({label:window.label,...metrics(row)});});
              }catch{ /* Unavailable windows remain gaps, never zeroes. */ }
            }
          }));
        }
        daily.sort((a,b)=>a.label.localeCompare(b.label));
        const incomplete=daily.length<windows.length,estimated=daily.some(row=>row.estimated);
        const value={state:'ready',range,hosts,updatedAt:end.toISOString(),daily,incomplete,estimated,missingDays:windows.length-daily.length,
          pageviews:daily.length?daily.reduce((sum,row)=>sum+row.pageviews,0):null,
          visits:daily.some(row=>row.visits!==null)?daily.reduce((sum,row)=>sum+(row.visits??0),0):null,
          ...Object.fromEntries(['pages','landings'].map(key=>[key,data[key].map(row=>({label:String(row.dimensions?.label||'Unknown').split('?')[0].slice(0,250),...metrics(row)}))]))};
        if(cache.size>=64)cache.delete(cache.keys().next().value);
        cache.set(key,{until:Date.now()+60000,value});
        return value;
      }catch{return {state:'error',reason:'unavailable'};}
    })();
    pending.set(key,task);
    try{return await task;}finally{pending.delete(key);}
  };
}
export const trafficAnalytics=createTrafficAnalytics();
