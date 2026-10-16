let ctx,state=null,busy=false,generation=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=s=>new Date(s).toLocaleString('en-GB',{timeZone:'Europe/London'});
export function configureBucket(context){ctx=context;}
export function resetBucket(){state=null;generation++;}
async function load(){const id=++generation;state={loading:true};try{const data=await ctx.api('/api/bucket');if(id===generation)state=data;}catch(e){if(id===generation)state={error:e.message};}if(id===generation)ctx.render();}
export function bucket(){
 if(!state)void load();
 const head=`<header class="page-heading"><div><div class="eyebrow">NYE 2026</div><h1>Blackley’s Bucket</h1></div><div class="actions"><button class="button ghost" data-bucket="refresh" ${busy?'disabled':''}>Refresh entries</button><a class="button" href="/api/bucket?export=csv">Download CSV</a></div></header>`;
 if(!state||state.loading)return head+'<p role="status">Loading entries…</p>';
 if(state.error)return head+`<p class="form-message" role="alert">${esc(state.error)}</p>`;
 const entries=state.entries,called=entries.find(e=>e.status==='called'),played=entries.filter(e=>e.status==='played').length,remaining=entries.filter(e=>e.status==='entered'&&e.eligible).length;
 const stat=(label,value)=>`<article class="stat"><div class="stat-top">${label}</div><div class="stat-value">${value}</div></article>`;
 return head+`<section class="stats">${stat('Sign-ups',entries.length)}${stat('Eligible names remaining',remaining)}${stat('DJ slots filled',`${played} / 8`)}</section>
 <section class="panel"><div class="panel-head"><h2>Live draw</h2><a class="text-link" href="https://www.upforitevents.co.uk/events/nye-2026/blackleys-bucket" target="_blank" rel="noopener">View entry page</a></div><div class="settings-body">
 ${!state.drawOpen?'<p>The live draw opens at doors and runs for the first two hours. Refresh on the night.</p>':''}
 ${called?`<h2>${esc(called.dj_name)}</h2><p>${called.checked_in?'Checked in':'Not yet checked in'} · ${called.eligible?'Ticket valid':'Ticket no longer valid'}</p><div class="actions"><button class="button primary" data-bucket="played" data-id="${esc(called.id)}" ${busy||!state.drawOpen||!called.eligible?'disabled':''}>Present — confirm slot</button><button class="button" data-bucket="skipped" data-id="${esc(called.id)}" ${busy||!state.drawOpen?'disabled':''}>Absent — skip name</button></div>`:`<button class="button primary" data-bucket="draw" ${busy||!state.drawOpen||!remaining||played>=8?'disabled':''}>${busy?'Drawing…':'Draw the next DJ'}</button>`}
 </div></section>
 <section class="panel"><div class="panel-head"><h2>Sign-ups</h2></div><div class="table-wrap"><table><thead><tr><th>DJ name</th><th>Account / email</th><th>Ticket</th><th>Arrival</th><th>Status</th><th>Signed up</th></tr></thead><tbody>${entries.map(e=>`<tr><td><strong>${esc(e.dj_name)}</strong></td><td>${esc(e.display_name)}<small>${esc(e.email)}</small></td><td>${e.eligible?'Valid':'Ineligible'}</td><td>${e.checked_in?'Checked in':'Not checked in'}</td><td>${esc(e.status)}</td><td>${when(e.created_at)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No Bucket sign-ups yet.</td></tr>'}</tbody></table></div></section>
 <section class="panel"><div class="panel-head"><h2>Draw history</h2></div><div class="table-wrap"><table><thead><tr><th>Time</th><th>DJ</th><th>Action</th><th>Admin / entrant</th></tr></thead><tbody>${state.audit.map(a=>`<tr><td>${when(a.created_at)}</td><td>${esc(a.dj_name)}</td><td>${esc(a.action)}</td><td>${esc(a.actor)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No activity yet.</td></tr>'}</tbody></table></div></section>`;
}
document.addEventListener('click',async event=>{
 const el=event.target.closest('[data-bucket]');if(!el||busy)return;
 if(el.dataset.bucket==='refresh'){resetBucket();ctx.render();return;}
 busy=true;const id=generation;ctx.render();
 try{const result=await ctx.api('/api/bucket',{action:el.dataset.bucket,entryId:el.dataset.id});if(id===generation)state=result;}
 catch(e){ctx.toast(e.message);if(id===generation)state=null;}
 finally{busy=false;ctx.render();}
});
