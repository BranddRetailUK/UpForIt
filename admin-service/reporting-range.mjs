import {httpError} from './security.mjs';
const dayMs=86400000;
export function reportingRange(params,now=new Date()){
 const from=params.get('from'),to=params.get('to');
 if(from!==null||to!==null){
  const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!valid(from)||!valid(to))throw httpError(400,'Choose valid start and end dates.');
  const start=new Date(from+'T00:00:00Z'),last=new Date(to+'T00:00:00Z');
  if(start>last)throw httpError(400,'The end date must be on or after the start date.');
  if(to>now.toISOString().slice(0,10))throw httpError(400,'Choose dates up to today.');
  if(last-start>=366*dayMs)throw httpError(400,'Choose a date range of up to 366 days.');
  const end=new Date(Math.min(last.getTime()+dayMs,now.getTime()));
  if(start>=end)throw httpError(400,'This date range has not started yet.');
  return {since:start.toISOString(),until:end.toISOString(),days:(end-start)/dayMs,from,to,period:'custom'};
 }
 const preset=params.get('days');
 if(['today','yesterday','mtd','lastmonth','ytd'].includes(preset)){
  const midnight=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
  const since=preset==='today'?midnight:preset==='yesterday'?midnight-dayMs:preset==='mtd'?Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1):preset==='lastmonth'?Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1):Date.UTC(now.getUTCFullYear(),0,1);
  const until=preset==='yesterday'?midnight:preset==='lastmonth'?Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1):now.getTime();
  return {since:new Date(since).toISOString(),until:new Date(until).toISOString(),days:(until-since)/dayMs,period:preset};
 }
 const days=Number(params.get('days')||30);
 if(![1,7,14,30,90].includes(days))throw httpError(400,'Choose 24 hours, 7 days, 30 days or a custom range.');
 return {since:new Date(now.getTime()-days*dayMs).toISOString(),until:now.toISOString(),days,period:String(days)};
}
