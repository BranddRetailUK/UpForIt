let ctx,state=null,generation=0,busy=false,message='';
const defaults={sales:true,bucket:true,signups:true};
const choices=[['sales','Ticket sales','Completed paid orders'],['bucket','Blackley’s Bucket','New DJ sign-ups'],['signups','User sign-ups','New customer accounts']];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function configureNotifications(context){ctx=context;}
export function resetNotifications(){generation++;state=null;message='';busy=false;}
const supported=()=>!!(window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);
const onHomeScreen=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
async function registration(){
 const r=await navigator.serviceWorker.register('/admin-sw.js',{scope:'/mobile',updateViaCache:'none'});
 if(!r.active)await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Notification setup took too long. Try again.')),10000))]);
 return r;
}
async function load(){
 const token=++generation;state={loading:true};
 try{
  const config=await ctx.api('/api/notifications');
  const ready=supported()&&(!isIOS()||onHomeScreen());
  const r=ready&&config.enabled?await registration():null;
  const subscription=r?await r.pushManager.getSubscription():null;
  const device=subscription?await ctx.api('/api/notifications/status',{endpoint:subscription.endpoint}):{enabled:false,preferences:defaults};
  if(token===generation)state={config,ready,registration:r,subscription,...device,preferences:device.preferences||defaults};
 }catch(error){if(token===generation)state={error:error.message};}
 if(token===generation&&location.hash==='#notifications')ctx.render();
}
export function notifications(){
 if(!state)void load();
 if(!state||state.loading)return '<p class="empty" role="status">Checking notifications…</p>';
 if(state.error)return `<p class="notice" role="alert">${esc(state.error)}</p><button class="button" data-notification="reload">Try again</button>`;
 const denied=supported()&&Notification.permission==='denied';
 const canUse=state.config.enabled&&state.ready&&!denied;
 const status=!state.config.enabled?'Notification delivery is not configured yet.':isIOS()&&!onHomeScreen()?'Open UpForIt ADMIN from its Home Screen icon to enable iPhone notifications.':!supported()?'This browser does not support notifications. Use the installed app on iOS 16.4 or later.':denied?'Notifications are blocked. Allow them for UpForIt ADMIN in your device’s notification settings, then reopen the app.':state.enabled?'Notifications are on for this device.':'Enable alerts on this device, even when the app is closed.';
 return `<h1 class="sr-only">Notifications</h1><section class="panel notification-settings"><div class="panel-head"><h2>Notifications</h2></div><div class="settings-body"><p>${status}</p><form id="notification-preferences"><fieldset ${busy||!canUse?'disabled':''}><legend class="sr-only">Choose alerts</legend>${choices.map(([key,label,description])=>`<label class="notification-choice"><span><strong>${label}</strong><small>${description}</small></span><input type="checkbox" name="${key}" ${state.preferences[key]?'checked':''}></label>`).join('')}</fieldset><div class="notification-actions"><button class="button primary" type="button" data-notification="${state.enabled?'save':'enable'}" ${busy||!canUse?'disabled':''}>${busy?'Please wait…':state.enabled?'Save preferences':'Enable notifications'}</button>${state.enabled?`<button class="button" type="button" data-notification="test" ${busy||!canUse?'disabled':''}>Send test notification</button><button class="button ghost" type="button" data-notification="disable" ${busy?'disabled':''}>Turn off on this device</button>`:''}</div></form><p class="form-message" role="status">${esc(message)}</p><p class="tiny">Alerts start from when you enable them. Names, emails and payment details stay inside the admin app.</p></div></section>`;
}
const applicationKey=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-notification]');if(!button||busy)return;
 const action=button.dataset.notification;
 if(action==='reload'){resetNotifications();ctx.render();return;}
 if(!state?.config||!state.ready)return;
 const token=generation,form=document.querySelector('#notification-preferences');
 const preferences=Object.fromEntries(choices.map(([key])=>[key,form.elements[key].checked]));
 // iOS requires requesting permission directly in this tap handler, before other awaits.
 const permission=action==='enable'?Notification.requestPermission():null;
 busy=true;message='';ctx.render();
 try{
  if(action==='enable'||action==='save'){
   if(permission&&await permission!=='granted')throw Error('Permission was not granted. Allow notifications in device settings to enable alerts.');
   let subscription=await state.registration.pushManager.getSubscription();
   const key=applicationKey(state.config.publicKey);
   if(subscription?.options.applicationServerKey&&String(new Uint8Array(subscription.options.applicationServerKey))!==String(key)){await subscription.unsubscribe();subscription=null;}
   if(!subscription)subscription=await state.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   const result=await ctx.api('/api/notifications/subscribe',{subscription:subscription.toJSON(),preferences});
   if(token===generation){Object.assign(state,result,{subscription});message='Preferences saved for this device.';}
  }else if(action==='disable'){
   await ctx.api('/api/notifications/unsubscribe',{endpoint:state.subscription.endpoint});
   await state.subscription.unsubscribe().catch(()=>false);
   if(token===generation){state.enabled=false;state.subscription=null;message='Notifications are off on this device.';}
  }else if(action==='test'){
   await ctx.api('/api/notifications/test',{endpoint:state.subscription.endpoint});
   if(token===generation)message='Test sent. Check your notifications to confirm it arrived.';
  }
 }catch(error){if(token===generation)message=error.message;}
 finally{if(token===generation){busy=false;if(location.hash==='#notifications')ctx.render();}}
});
export async function notificationLogoutEndpoint(){
 if(!supported())return null;
 try{const r=await navigator.serviceWorker.getRegistration('/mobile');return (await r?.pushManager.getSubscription())?.endpoint||null;}catch{return null;}
}
export async function clearLocalNotifications(){
 if(!supported())return;
 try{const r=await navigator.serviceWorker.getRegistration('/mobile');const s=await r?.pushManager.getSubscription();if(s)await s.unsubscribe();for(const n of await r?.getNotifications()||[])n.close();}catch{}
}
