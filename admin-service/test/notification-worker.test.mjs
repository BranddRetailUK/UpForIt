import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/admin-sw.js',import.meta.url),'utf8');
test('push worker displays visible notifications and only navigates to allowlisted admin sections',async()=>{
 const handlers={},shown=[],opened=[],navigated=[];
 const self={location:{origin:'https://admin.example.test'},addEventListener:(name,fn)=>handlers[name]=fn,
 registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[
  {url:'https://evil.test/mobile',navigate:async()=>assert.fail('external client'),focus:async()=>{}},
  {url:'https://admin.example.test/mobile',navigate:async url=>navigated.push(url),focus:async()=>{}}
 ],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(source,{self,URL});
 let pending;const event={data:{json:()=>({kind:'sales',body:'A ticket sale.',url:'https://evil.test',tag:'same-event'})},waitUntil:p=>pending=p};
 handlers.push(event);await pending;
 assert.equal(shown[0][0],'UpForIt ADMIN');assert.equal(shown[0][1].body,'A ticket sale.');assert.equal(shown[0][1].tag,'same-event');
 handlers.notificationclick({notification:{data:{kind:'sales',url:'https://evil.test'},close(){}},waitUntil:p=>pending=p});await pending;
 assert.deepEqual(navigated,['https://admin.example.test/mobile#tickets']);assert.equal(opened.length,0);
 self.clients.matchAll=async()=>[];
 handlers.notificationclick({notification:{data:{kind:'unexpected'},close(){}},waitUntil:p=>pending=p});await pending;
 assert.deepEqual(opened,['https://admin.example.test/mobile#overview']);
 assert.equal(handlers.fetch,undefined,'private pages are never cached');
});
