// Sends synthetic events only to Meta Test Events. Never writes orders or entries.
import {execFileSync} from "node:child_process";
import {randomUUID} from "node:crypto";
import {sendMetaConversion} from "../lib/meta-conversion";
import {bucketRegistrationEvent} from "../lib/meta-bucket";

async function main(){
 const testCode=process.argv[2];
 if(!/^TEST\d+$/.test(testCode||""))throw new Error("An Events Manager TEST code is required.");
 const vars=JSON.parse(execFileSync("railway",["variable","list","--service","FRONTEND","--environment","production","--json"],{encoding:"utf8"}));
 for(const key of ["NEXT_PUBLIC_META_PIXEL_ID","META_CONVERSIONS_API_ACCESS_TOKEN","META_GRAPH_API_VERSION"])process.env[key]=vars[key];
 process.env.META_TEST_EVENT_CODE=testCode;
 const user={id:`tracking-test-${randomUUID()}`,email:"tracking-test@example.invalid"};
 const registration=bucketRegistrationEvent(randomUUID(),user,{consent:true})!;
 const events=[
  {eventName:"Purchase" as const,eventId:`test_ticket_purchase_${randomUUID()}`,eventSourceUrl:"https://www.upforitevents.co.uk/events/nye-2026",valueMinor:1000,currency:"GBP",contentName:"TEST ONLY — NYE ticket",contentCategory:"event tickets",contents:[{id:"test-ticket",quantity:1,itemPriceMinor:1000}],userData:{email:user.email,externalId:user.id}},
  registration
 ];
 for(const event of events){
  const result=await sendMetaConversion(event);
  console.log(JSON.stringify({testOnly:true,eventName:event.eventName,eventId:event.eventId,...result}));
  if(!result.sent)process.exitCode=1;
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
