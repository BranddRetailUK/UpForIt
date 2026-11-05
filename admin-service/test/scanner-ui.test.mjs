import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/scanner.js',import.meta.url),'utf8');
async function fixture(responses=[]){
 const elements=new Map(),timers=[],requests=[];let decode,now=10000;
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:['result','scanner','retry'].includes(id),textContent:'',className:'',append(){},focus(){},reset(){},querySelector(){return element('button');}});return elements.get(id);};
 const context=vm.createContext({document:{hidden:false,getElementById:element,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},location:{hash:'',search:'',pathname:'/scan'},URLSearchParams,crypto:{randomUUID:()=>`request-${requests.length}`},AbortSignal,Date:class extends Date{static now(){return now;}},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout(){},ZXingBrowser:{BrowserQRCodeReader:class{async decodeFromConstraints(a,b,cb){decode=cb;return {stop(){}};}}},fetch:async(path,options)=>{if(path.endsWith('/session'))return {ok:true,json:async()=>({admin:false,label:'Test scanner'})};requests.push(JSON.parse(options.body));const response=responses.shift();if(response instanceof Error)throw response;return {ok:!response?.status,status:response?.status,json:async()=>response||{ok:true,ticket:{ticket_number:'UFI-T-010001'}}};}});
 vm.runInContext(source,context);await new Promise(setImmediate);
 return {element,requests,timers,scan:code=>{decode({getText:()=>code});return new Promise(setImmediate);},tick:ms=>{now+=ms;},run:code=>vm.runInContext(code,context)};
}
test('successful scans hold for two seconds, preserve ticket number and ignore a held QR',async()=>{
 const f=await fixture();await f.scan('first-ticket');assert.equal(f.element('result').className,'is-success');assert.equal(f.element('ticket-number').textContent,'UFI-T-010001');assert.equal(f.timers[0].ms,2000);
 await f.scan('second-ticket');assert.equal(f.requests.length,1);
 f.timers[0].fn();assert.equal(f.element('result').hidden,true);assert.equal(f.element('scan-state').textContent,'Ready to scan');
 await f.scan('second-ticket');assert.equal(f.requests.length,1);
 f.tick(1000);await f.scan('second-ticket');assert.equal(f.requests.length,2);
});
test('uncertain network outcome stays paused and retry preserves the original request ID',async()=>{
 const f=await fixture([new Error('offline'),{ok:true,replayed:true,ticket:{ticket_number:'UFI-T-010001'}}]);await f.scan('ticket');
 assert.equal(f.element('result').className,'is-error');assert.equal(f.element('retry').hidden,false);assert.equal(f.element('dismiss').hidden,true);assert.equal(f.timers.length,0);
 await f.scan('other');assert.equal(f.requests.length,1);f.element('retry').onclick();await new Promise(setImmediate);
 assert.deepEqual(f.requests[0],f.requests[1]);assert.equal(f.element('result').className,'is-success');
});
test('duplicate rejection requires acknowledgement; rehearsals are explicitly not admissions',async()=>{
 const f=await fixture([{status:409,error:'Already used',ticket:{ticket_number:'UFI-T-010001'}},{ok:true,validationOnly:true,ticket:{ticket_number:'UFI-T-010002'}}]);
 await f.scan('used');assert.equal(f.element('result').className,'is-error');assert.equal(f.element('dismiss').hidden,false);assert.equal(f.timers.length,0);
 f.element('dismiss').onclick();await f.scan('future');assert.equal(f.element('result').className,'is-rehearsal');assert.match(f.element('result-detail').textContent,/Not admitted/);assert.equal(f.timers[0].ms,2000);
});
