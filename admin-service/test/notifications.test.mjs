import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import {validateEndpoint,validateSubscription,validatePreferences,pushPayload,pushConfiguration} from '../notifications.mjs';
const ecdh=createECDH('prime256v1');ecdh.generateKeys();
const subscription={endpoint:'https://web.push.apple.com/example',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
test('push subscription permits Apple, Google and Mozilla and rejects outbound request abuse',()=>{
 assert.deepEqual(validateSubscription(subscription),subscription);
 for(const url of ['http://web.push.apple.com/x','https://web.push.apple.com.attacker.test/x','https://127.0.0.1/x','https://web.push.apple.com:8443/x','https://user@web.push.apple.com/x','https://web.push.apple.com/x#fragment'])assert.throws(()=>validateEndpoint(url),{status:400});
 for(const url of ['https://fcm.googleapis.com/fcm/send/test','https://updates.push.services.mozilla.com/wpush/v2/test'])assert.equal(validateEndpoint(url),url);
 assert.throws(()=>validateSubscription({...subscription,keys:{...subscription.keys,p256dh:Buffer.alloc(65).toString('base64url')}}),{status:400});
 assert.throws(()=>validateSubscription({...subscription,keys:{...subscription.keys,auth:'invalid'}}),{status:400});
});
test('all three preferences require actual booleans and lock-screen payloads contain no customer data',()=>{
 assert.deepEqual(validatePreferences({sales:true,bucket:false,signups:true}),{sales:true,bucket:false,signups:true});
 for(const p of [{sales:'true',bucket:true,signups:true},{sales:true},{sales:true,bucket:true,signups:true,extra:true}])assert.throws(()=>validatePreferences(p),{status:400});
 assert.deepEqual(pushPayload('sales','order-secret'),pushPayload('sales','order-secret'));
 assert.ok(!JSON.stringify(pushPayload('sales','order-secret')).includes('order-secret'));
 assert.notEqual(pushPayload('sales','one').tag,pushPayload('sales','two').tag);
 assert.throws(()=>pushPayload('unexpected','one'));
 assert.deepEqual(pushConfiguration({}),{enabled:false,publicKey:null});
});
