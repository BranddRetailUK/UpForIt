import {expect,it,vi} from 'vitest';
import {recoverTicketCheckout} from './ticket-checkout-recovery';
it.each([
 {age:29,status:'open',expires:false},
 {age:30,status:'open',expires:true},
 {age:31,status:'complete',expires:false},
])('reconciles a $age minute $status checkout safely',async({age,status,expires})=>{
 const order={id:'order',status:'pending',total_minor:1000,currency:'gbp',stripe_checkout_session_id:'cs',checkout_attempted_at:new Date(Date.now()-age*60000),event_status:'published',sales_open:true,sales_deadline:new Date(Date.now()+86400000)};
 const session={id:'cs',status,mode:'payment',client_reference_id:'order',metadata:{ticketOrderId:'order'},amount_total:1000,currency:'gbp',url:'https://checkout.stripe.com/test'};
 const expire=vi.fn(async()=>({...session,status:'expired',url:null}));
 const db={release:vi.fn(),query:vi.fn(async(sql:string,args?:unknown[])=>{
  if(sql.includes('pg_try_advisory_lock'))return {rows:[{locked:true}]};
  if(sql.includes('SELECT o.*'))return {rows:[order]};
  if(sql.includes('RETURNING status'))return {rows:[{status:args?.[3]==='expired'?'expired':'pending'}]};
  return {rows:[]};
 })};
 const result=await recoverTicketCheckout({connect:async()=>db} as never,{checkout:{sessions:{retrieve:async()=>session,expire}}} as never,'order','resume');
 expect(expire).toHaveBeenCalledTimes(expires?1:0);
 if(expires)expect(result).toMatchObject({orderStatus:'expired',canStartNew:true});
 else if(status==='complete')expect(result).toMatchObject({code:'payment_confirming'});
 else expect(result).toMatchObject({url:session.url});
});
