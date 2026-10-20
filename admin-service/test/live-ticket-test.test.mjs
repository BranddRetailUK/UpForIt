import test from 'node:test';
import assert from 'node:assert/strict';
import {liveStripeRequest,liveTestEnabled,priceTest} from '../live-ticket-test.mjs';
test('live transport encodes nested Stripe parameters, uses server-only headers and returns generic provider errors',async()=>{
 const old={flag:process.env.ADMIN_LIVE_TICKET_TESTS_ENABLED,env:process.env.APP_ENV,key:process.env.STRIPE_SECRET_KEY,fetch:globalThis.fetch};
 try{
  process.env.ADMIN_LIVE_TICKET_TESTS_ENABLED='true';process.env.APP_ENV='production';process.env.STRIPE_SECRET_KEY='sk_live_unit_test_placeholder';
  assert.equal(liveTestEnabled(),true);
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer sk_live_unit_test_placeholder');assert.equal(options.headers['Idempotency-Key'],'stable-intent');
   const form=new URLSearchParams(options.body);assert.equal(form.get('line_items[0][price_data][unit_amount]'),'1000');assert.equal(form.get('line_items[0][quantity]'),'1');assert.equal(form.get('metadata[ticketOrderId]'),'order-id');assert.equal(form.get('payment_method_types[0]'),'card');
   return Response.json({id:'cs_fixture'});
  };
  assert.deepEqual(await liveStripeRequest('','POST',{metadata:{ticketOrderId:'order-id'},payment_method_types:['card'],line_items:[{quantity:1,price_data:{unit_amount:1000}}]},'stable-intent'),{id:'cs_fixture'});
  globalThis.fetch=async()=>new Response('private provider diagnostics',{status:401});await assert.rejects(liveStripeRequest(''),e=>e.status===502&&!e.message.includes('private'));
  process.env.APP_ENV='testing';assert.equal(liveTestEnabled(),false);await assert.rejects(liveStripeRequest(''),e=>e.status===503);
 }finally{for(const[name,value]of [['ADMIN_LIVE_TICKET_TESTS_ENABLED',old.flag],['APP_ENV',old.env],['STRIPE_SECRET_KEY',old.key]])if(value===undefined)delete process.env[name];else process.env[name]=value;globalThis.fetch=old.fetch;}
});
test('live test pricing rejects invalid quantities and altered NYE price',()=>{
 const tier={slug:'nye-2026',currency:'gbp',price_minor:1000,max_per_order:10,capacity:null,name:'Admission'};
 for(const q of [0,-1,11,1.5,NaN,'1'])assert.throws(()=>priceTest(tier,q));
 assert.throws(()=>priceTest({...tier,price_minor:1},1));assert.throws(()=>priceTest({...tier,currency:'usd'},1));
});
