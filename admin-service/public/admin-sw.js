// Notifications only: never cache private pages/API data or queue offline writes.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
const routes={sales:'tickets',bucket:'bucket',signups:'accounts',test:'notifications'};
const titles={sales:'New order',bucket:'New Bucket entry',signups:'New signup',test:'Test notification'};
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 const kind=Object.hasOwn(routes,data.kind)?data.kind:'test';
 const title=Object.hasOwn(titles,data.kind)?titles[data.kind]:'Admin update';
 event.waitUntil(self.registration.showNotification(title,{
  body:typeof data.body==='string'?data.body.slice(0,200):'You have a new admin update.',
  icon:'/assets/admin-icon-192.png',badge:'/assets/admin-icon-192.png',
  tag:typeof data.tag==='string'?data.tag.slice(0,100):'upforit-update',
  data:{kind}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const kind=event.notification.data?.kind;
 const url=new URL('/mobile#'+(Object.hasOwn(routes,kind)?routes[kind]:'overview'),self.location.origin).href;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   const current=new URL(client.url);
   if(current.origin===self.location.origin&&['/mobile','/mobile.html'].includes(current.pathname)){
    await client.navigate(url);await client.focus();return;
   }
  }
  await self.clients.openWindow(url);
 })());
});
