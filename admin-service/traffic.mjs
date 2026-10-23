// Direct, consented storefront page loads. No external analytics calls.
export function createTrafficAnalytics({db, now=()=>new Date()}={}) {
 const cache=new Map(),pending=new Map();
 return async function trafficAnalytics(input=7) {
  const range=typeof input==='object'?input:{since:new Date(now().getTime()-input*86400000).toISOString(),until:now().toISOString()};
  const key=range.period && range.period!=='custom'?range.period:range.since+'|'+range.until;
  if(cache.get(key)?.expires>Date.now())return cache.get(key).value;
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{try {
   const {rows}=await db.query(`WITH hits AS MATERIALIZED (
     SELECT * FROM site_page_hits WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
   ), entries AS (
     SELECT h.* FROM hits h WHERE NOT EXISTS (SELECT 1 FROM site_page_hits prior WHERE prior.session_id=h.session_id AND (prior.created_at,prior.id)<(h.created_at,h.id))
   ) SELECT
   (SELECT started_at FROM site_analytics_started WHERE id) AS started,
   (SELECT count(*)::int FROM hits) AS pageviews,
   (SELECT count(DISTINCT visitor_id)::int FROM hits) AS visitors,
   (SELECT count(*)::int FROM entries) AS visits,
   (SELECT json_agg(d) FROM (SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') label,count(*)::int pageviews FROM hits GROUP BY 1 ORDER BY 1) d) AS daily,
   (SELECT json_agg(d) FROM (SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') label,count(*)::int visits FROM entries GROUP BY 1) d) AS sessions,
   (SELECT json_agg(d) FROM (SELECT path label,count(*)::int pageviews FROM hits GROUP BY path ORDER BY count(*) DESC,path LIMIT 10) d) AS pages,
   (SELECT json_agg(d) FROM (SELECT path label,count(*)::int visits FROM entries GROUP BY path ORDER BY count(*) DESC,path LIMIT 10) d) AS landings`,[range.since,range.until]);
   const result=rows[0];if(!result?.started)throw Error('Tracking migration required');
   const started=new Date(result.started).toISOString(),daily=[];
   for(let day=new Date(range.since.slice(0,10)+'T00:00:00Z');day<new Date(range.until);day.setUTCDate(day.getUTCDate()+1)){
    const label=day.toISOString().slice(0,10),available=day.getTime()+86400000>Date.parse(started);
    daily.push({label,pageviews:available?(result.daily||[]).find(r=>r.label===label)?.pageviews||0:null,visits:available?(result.sessions||[]).find(r=>r.label===label)?.visits||0:null});
   }
   const available=Date.parse(range.until)>Date.parse(started);
   const value={state:'ready',source:'direct',range,startedAt:started,updatedAt:now().toISOString(),daily,incomplete:Date.parse(range.since)<Date.parse(started),pageviews:available?result.pageviews:null,visits:available?result.visits:null,visitors:available?result.visitors:null,pages:result.pages||[],landings:result.landings||[]};
   if(cache.size>=64)cache.delete(cache.keys().next().value);
   cache.set(key,{expires:Date.now()+30000,value});return value;
  }catch{return {state:'error',reason:'unavailable'};}})();
  pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 };
}
