'use client';
import { useEffect,useState } from 'react';
type Entry={id:string;dj_name:string;email:string;status:string;eligible:boolean;checked_in:boolean};
type Data={drawOpen:boolean;entries:Entry[];audit:{action:string;created_at:string;dj_name:string;actor:string}[]};
export default function BucketAdmin(){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function refresh(){setError('');try{const r=await fetch('/api/admin/bucket',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}catch(e){setError(e instanceof Error?e.message:'Could not load entries.');}}
  useEffect(()=>{void refresh();},[]);
  async function act(action:string,entryId?:string){setBusy(true);setError('');try{const r=await fetch('/api/admin/bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,entryId})});const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}catch(e){setError(e instanceof Error?e.message:'Could not update draw.');}finally{setBusy(false);}}
  const called=data?.entries.find(e=>e.status==='called');
  const played=data?.entries.filter(e=>e.status==='played').length||0;
  const remaining=data?.entries.filter(e=>e.status==='entered'&&e.eligible).length||0;
  return <div className="bucket-admin">
    <div className="bucket-admin-actions"><button className="industrial-button" disabled={busy} onClick={refresh}>Refresh entries</button><a href="/api/admin/bucket?export=csv">Download CSV</a><a href="/events/nye-2026/blackleys-bucket">View page</a></div>
    {error&&<p role="alert">{error}</p>}
    {!data?<p>Loading entries…</p>:<>
      <p>{data.entries.length} entries · {remaining} eligible names remaining · {played}/8 slots filled</p>
      {!data.drawOpen&&<p>The live draw opens at doors and runs for the first two hours. Refresh this page on the night.</p>}
      {called?<section className="bucket-admin-called"><h2>{called.dj_name}</h2><p>{called.checked_in?'Checked in':'Not yet checked in'} · {called.eligible?'Ticket valid':'Ticket no longer valid'}</p><button className="industrial-button" disabled={busy||!data.drawOpen||!called.eligible} onClick={()=>act('played',called.id)}>Present — confirm slot</button><button disabled={busy||!data.drawOpen} onClick={()=>act('skipped',called.id)}>Absent — skip name</button></section>:<button className="industrial-button" disabled={busy||!data.drawOpen||!remaining||played>=8} onClick={()=>act('draw')}>{busy?'Drawing…':'Draw the next DJ'}</button>}
      <div className="bucket-admin-table"><table><thead><tr><th>DJ name</th><th>Email</th><th>Ticket</th><th>Arrival</th><th>Draw status</th></tr></thead><tbody>{data.entries.map(e=><tr key={e.id}><td>{e.dj_name}</td><td>{e.email}</td><td>{e.eligible?'Valid':'Ineligible'}</td><td>{e.checked_in?'Checked in':'Not checked in'}</td><td>{e.status}</td></tr>)}</tbody></table></div>
      <h2>Draw history</h2><ul>{data.audit.map((a,i)=><li key={`${a.created_at}-${i}`}>{new Date(a.created_at).toLocaleString('en-GB',{timeZone:'Europe/London'})} · {a.dj_name} · {a.action} · {a.actor}</li>)}</ul>
    </>}
  </div>;
}
