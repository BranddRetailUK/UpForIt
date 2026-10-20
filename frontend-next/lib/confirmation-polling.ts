export function confirmationRetryable(status: number) {
  return status===404 || status===408 || status===429 || status>=500;
}
export function confirmationRetryDelay(attempt: number) {
  return Math.min(10000,1000*2**Math.min(attempt,4));
}
export function pollConfirmation<T extends {status:string}>(options:{
 sessionId:string; result:(result:T)=>void; waiting:()=>void; signIn:()=>void; error:()=>void;
 fetcher?:typeof fetch;
}) {
 let stopped=false,attempts=0,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
 const again=()=>{if(stopped)return;if(attempts<12)timer=setTimeout(refresh,confirmationRetryDelay(attempts));else options.waiting();};
 async function refresh(){
  attempts++;controller=new AbortController();const active=controller;
  const timeout=setTimeout(()=>active.abort(),15000);
  try{
   const response=await(options.fetcher??fetch)(`/api/tickets/confirmation?session_id=${encodeURIComponent(options.sessionId)}`,{cache:'no-store',signal:active.signal});
   if(stopped)return;
   if(response.status===401){options.signIn();return;}
   if(!response.ok){if(confirmationRetryable(response.status))again();else options.error();return;}
   const result=await response.json() as T;
   if(stopped)return;
   if(!result||typeof result.status!=='string'){again();return;}
   options.result(result);
   if(result.status==='pending')again();
  }catch{if(!stopped)again();}finally{clearTimeout(timeout);}
 }
 void refresh();
 return ()=>{stopped=true;clearTimeout(timer);controller?.abort();};
}
