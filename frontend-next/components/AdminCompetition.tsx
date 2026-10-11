"use client";
import { useEffect, useState } from "react";
import { MIX_GENRES, CompetitionSettings } from "../lib/mix-shared";
import SoundCloudMixPlayer from "./SoundCloudMixPlayer";
type Entry={id:string;artist:string;title:string;genre:string;email:string;source:string;source_url:string|null;audio_url:string|null;status:string;allow_download:boolean;votes:number;created_at:string};
type Vote={user_id:string;entry_id:string;email:string;invalidated_at:string|null;invalidation_reason:string|null;disabled_at:string|null;email_verified_at:string|null};
type Data={settings:CompetitionSettings;entries:Entry[];votes:Vote[];audit:{action:string;created_at:string;display_name:string}[]};
const inputDate=(date:string)=>new Date(date).toISOString().slice(0,16);
export default function AdminCompetition(){
 const [data,setData]=useState<Data|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/admin/competition',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}catch(e){setMessage(e instanceof Error?e.message:'Could not load competition.');}}
 useEffect(()=>{void load();},[]);
 async function save(body:unknown){setBusy(true);setMessage('');try{const r=await fetch('/api/admin/competition',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage('Saved.');await load();}catch(e){setMessage(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}
 if(!data)return <p role="status">{message||'Loading competition…'}</p>;
 return <div className="competition-admin"><p role="status">{message}</p>
 <div className="admin-metrics"><article><strong>{data.entries.length}</strong><span>Entries</span></article><article><strong>{data.entries.reduce((n,e)=>n+(e.status==='published'?e.votes:0),0)}</strong><span>Valid votes for visible entries</span></article><article><strong>{data.entries.filter(e=>e.status==='hidden').length}</strong><span>Hidden entries</span></article></div>
 <section className="admin-panel"><h2>Competition settings</h2><p>Deadlines use UTC (the same as UK time in November). Entries publish immediately. The highest valid vote count wins automatically at the announcement time; ties need confirmation below.</p>
 <form key={JSON.stringify(data.settings)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({action:'settings',submissionsOpen:f.has('submissionsOpen'),votingOpen:f.has('votingOpen'),submissionsClose:new Date(String(f.get('submissionsClose'))+'Z').toISOString(),votingClose:new Date(String(f.get('votingClose'))+'Z').toISOString(),announceAt:new Date(String(f.get('announceAt'))+'Z').toISOString()});}}>
 <label><input type="checkbox" name="submissionsOpen" defaultChecked={data.settings.submissions_open}/> Allow submissions until deadline</label><label><input type="checkbox" name="votingOpen" defaultChecked={data.settings.voting_open}/> Allow voting until deadline</label>
 <div className="competition-admin-fields">{[['submissionsClose','Submissions close',data.settings.submissions_close_at],['votingClose','Voting closes',data.settings.voting_close_at],['announceAt','Announce winner',data.settings.announce_at]].map(([name,label,value])=><label key={name}>{label} (UTC)<input type="datetime-local" name={name} defaultValue={inputDate(value)} required/></label>)}</div><button className="industrial-button" disabled={busy}>Save settings</button></form></section>
 <section className="admin-panel"><h2>Entries and votes</h2><a className="industrial-link" href="/api/admin/competition?export=csv">Export CSV</a> <button onClick={()=>void load()} disabled={busy}>Refresh totals</button>
 {!data.entries.length&&<p>No entries yet.</p>}
 {data.entries.map(entry=><details key={entry.id} className="competition-admin-entry"><summary><strong>{entry.artist}</strong> — {entry.title} · {entry.votes} votes · {entry.status}</summary>
 <p>Submitted {new Date(entry.created_at).toLocaleString('en-GB',{timeZone:'Europe/London'})} · {entry.source}</p>
 {entry.source==='Link'&&entry.source_url?<SoundCloudMixPlayer url={entry.source_url}/>:<audio controls preload="none" src={entry.audio_url||undefined}/>}
 <form key={JSON.stringify(entry)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({action:'entry',id:entry.id,artist:f.get('artist'),title:f.get('title'),genre:f.get('genre'),email:f.get('email'),status:f.get('status'),allowDownload:f.has('allowDownload')});}}>
 <div className="competition-admin-fields"><label>Artist<input name="artist" defaultValue={entry.artist} maxLength={80} required/></label><label>Mix title<input name="title" defaultValue={entry.title} maxLength={120} required/></label><label>Contact email<input type="email" name="email" defaultValue={entry.email} required/></label><label>Genre<select name="genre" defaultValue={entry.genre}>{MIX_GENRES.map(g=><option key={g}>{g}</option>)}</select></label><label>Visibility<select name="status" defaultValue={entry.status}><option value="published">Published</option><option value="hidden">Hidden</option></select></label></div>
 {entry.source==='Upload'&&<label><input type="checkbox" name="allowDownload" defaultChecked={entry.allow_download}/> Allow original file download</label>}<button className="industrial-button" disabled={busy}>Save entry</button></form>
 <h3>Votes</h3>{data.votes.filter(v=>v.entry_id===entry.id).map(v=><form className="competition-admin-vote" key={v.user_id} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save({action:'vote',userId:v.user_id,invalidate:!v.invalidated_at,reason:f.get('reason')});}}><span>{v.email} · {v.invalidated_at?'Invalidated':v.disabled_at||!v.email_verified_at?'Account ineligible':'Valid'}</span><input name="reason" aria-label={`Reason for changing vote from ${v.email}`} placeholder="Reason for change" defaultValue={v.invalidation_reason||''} required minLength={3} maxLength={500}/><button disabled={busy}>{v.invalidated_at?'Restore vote':'Invalidate vote'}</button></form>)}
 <button className="industrial-button" disabled={busy||Date.now()<Date.parse(data.settings.voting_close_at)} onClick={()=>void save({action:'winner',id:entry.id})}>Confirm winner / resolve tie</button>
 </details>)}</section>
 <section className="admin-panel"><h2>Recent admin changes</h2>{data.audit.map((a,i)=><p key={i}>{new Date(a.created_at).toLocaleString('en-GB',{timeZone:'Europe/London'})} · {a.display_name} · {a.action.replace(/_/g,' ')}</p>)}</section>
 </div>;
}
