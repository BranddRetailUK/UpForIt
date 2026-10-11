"use client";

import SoundCloudMixPlayer from "./SoundCloudMixPlayer";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { CompetitionData, MIX_GENRES } from "../lib/mix-shared";
const formatTime = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

function Player({ src, artist, waveform }: { src: string; artist: string; waveform?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const pauseOther = (event: Event) => { if (event.target !== audio.current) audio.current?.pause(); };
    document.addEventListener("play", pauseOther, true);
    return () => document.removeEventListener("play", pauseOther, true);
  }, []);
  async function toggle() {
    if (!audio.current) return;
    if (playing) audio.current.pause();
    else { try { await audio.current.play(); setError(""); } catch { setError("Audio could not load. Please try again."); } }
  }
  return <div className="mix-player">
    <audio ref={audio} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={() => setTime(audio.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(Number.isFinite(audio.current?.duration) ? audio.current!.duration : 0)} onError={() => setError("Audio unavailable. Please try again later.")} />
    <button type="button" className="mix-play" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"} ${artist} mix`}>{playing ? "Ⅱ" : "▶"}</button>
    <div className="mix-track">
      {waveform ? <div className="sc-wave" style={{ maskImage: `url("${waveform}")`, WebkitMaskImage: `url("${waveform}")` }}><span style={{width:`${duration ? time/duration*100 : 0}%`}} /></div> : <div className="sc-wave-unavailable">Audio player</div>}
      <input className="mix-seek" aria-label={`Seek ${artist} mix`} type="range" min="0" max={duration || 1} step="0.1" value={time} disabled={!duration} onChange={event => { if (audio.current) { audio.current.currentTime = Number(event.target.value); setTime(Number(event.target.value)); } }} />
      <div className="mix-time"><span>{formatTime(time)}</span><span>{duration ? formatTime(duration) : "Loading audio…"}</span></div>
    </div>
    {error && <p className="mix-error" role="alert">{error}</p>}
  </div>;
}

export default function MixCompetition() {
  const [mode, setMode] = useState("Upload");
  const [allowDownload, setAllowDownload] = useState(false);
  const [data, setData] = useState<CompetitionData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [voteBusy, setVoteBusy] = useState(false);
  async function refresh() {
    try { const r = await fetch("/api/competition", {cache:"no-store"}); const value = await r.json(); if(!r.ok)throw new Error(value.error); setData(value); setLoadError(""); }
    catch(e){setLoadError(e instanceof Error?e.message:"Could not load the competition.");}
  }
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(),60000); return () => clearInterval(timer); }, []);
  const shown = data?.entries || [];
  const vote = data?.currentVote;
  function chooseFile(next?: File) {
    if (!next) return;
    if (!/\.(mp3|wav|m4a)$/i.test(next.name) || next.size <= 0 || next.size > 200*1024*1024) { setFile(null); setFormMessage("Choose an MP3, WAV or M4A audio file up to 200 MB."); return; }
    setFile(next); setFormMessage("");
  }
  async function requestJson(url: string, body: unknown) {
    const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const value=await r.json();if(!r.ok)throw new Error(value.error||"Please try again.");return value;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    if(mode==="Upload"&&!file){setFormMessage("Choose an audio file first.");return;}
    const form=event.currentTarget;const values=new FormData(form);setBusy(true);setFormMessage("");
    try {
      let uploadId: string | undefined;
      if(mode==="Upload"&&file){
        const prepared=await requestJson("/api/competition/upload",{filename:file.name,size:file.size});uploadId=prepared.id;
        const chunkSize=6*1024*1024;
        for(let start=0;start<file.size;start+=chunkSize){
          const end=Math.min(start+chunkSize,file.size); const payload=new FormData();
          for(const [key,value] of Object.entries(prepared.params))payload.append(key,String(value));
          payload.append("file",file.slice(start,end),file.name);
          const response=await fetch(prepared.url,{method:"POST",headers:{"X-Unique-Upload-Id":prepared.id,"Content-Range":`bytes ${start}-${end-1}/${file.size}`},body:payload});
          if(!response.ok)throw new Error("The audio upload failed. Please try again.");
          setFormMessage(`Uploading… ${Math.round(end/file.size*100)}%`);
        }
      }
      await requestJson("/api/competition/entries",{artist:values.get("artist"),title:values.get("title"),email:values.get("email"),genre:values.get("genre"),source:mode,url:values.get("mix-link"),uploadId,allowDownload:mode==="Upload"&&allowDownload});
      setFormMessage("Your mix is live. Share its link to let people listen and vote.");setFile(null);form.reset();await refresh();
    }catch(e){setFormMessage(e instanceof Error?e.message:"Could not submit your mix. Please try again.");}finally{setBusy(false);}
  }
  async function placeVote(entryId: string) {
    if(!data?.verified){setNotice("Sign in with a verified email to vote.");return;}
    setVoteBusy(true);
    try {await requestJson("/api/competition/vote",{entryId});setNotice("Your vote has been recorded. You can change it until voting closes.");await refresh();}
    catch(e){setNotice(e instanceof Error?e.message:"Could not record your vote.");}finally{setVoteBusy(false);}
  }
  async function share(id: string) {
    const url = `${window.location.origin}/music/competition#${id}`;
    try { await navigator.clipboard.writeText(url); setNotice("Entry link copied."); }
    catch { setNotice(`Share this entry: ${url}`); }
  }
  return <div className="competition">
    <section className="mix-hero">
      <div className="mix-hero-speakers" aria-hidden="true" />
      <div className="mix-hero-bars" aria-hidden="true" />
      <div className="section-wrap mix-hero-inner">
        <h1>UPFORIT NYE<br /><em>DJ MIX COMPETITION</em></h1>
        <p className="mix-hero-lead">Win a set at UpForIt NYE at McCarthys.</p>
        
        <div className="mix-actions"><a className="mix-button" href="#submit-mix"> SUBMIT YOUR MIX</a><a className="mix-outline" href="#how-it-works">HOW IT WORKS </a></div>
        
      </div>
    </section>
    <div className="section-wrap mix-layout">
      <section className="mix-entries" aria-label="Competition mixes">
        
        {loadError && <p role="alert" className="mix-error">{loadError} <button onClick={() => void refresh()}>Try again</button></p>}
        {!data && !loadError && <p>Loading competition…</p>}
        {data?.winner && <div className="mix-empty"><h2>OUR NYE WINNER: {data.winner.artist}</h2><p>{data.winner.title}</p></div>}
        {data?.tied && <p className="mix-notice">Voting has closed with a tie. The winner will be confirmed here.</p>}
        {data && !shown.length && <div className="mix-empty"><h2>BE THE FIRST TO ENTER</h2><p>No mixes have been submitted yet.</p><a className="mix-button" href="#submit-mix">SUBMIT YOUR MIX</a></div>}
        {data && !data.verified && <p className="mix-account-prompt">Listen freely. To vote, <a href="/account/login?next=%2Fmusic%2Fcompetition">sign in</a> or <a href="/account/signup?next=%2Fmusic%2Fcompetition">create an account</a> and confirm your email.</p>}
        <div className="mix-card-list">{shown.map((entry, index) => <article className="mix-card" key={entry.id} id={entry.id}>
          <div className={`mix-cover mix-cover-${entry.id}`} aria-hidden="true"><span>UPFORIT / SELECTS</span><strong>{entry.mark}</strong><small>NYE 2026 — {String(index + 1).padStart(2, "0")}</small></div>
          <div className="mix-card-main"><div className="mix-card-top"><div><div className="mix-artist-heading"><h3>{entry.artist}</h3><span className="mix-genre">{entry.genre}</span></div><p>{entry.title}</p></div>{entry.soundcloud && <a className="mix-soundcloud-logo" href={entry.soundcloud} target="_blank" rel="noreferrer" aria-label={`Listen to ${entry.artist} on SoundCloud`}><img src="https://developers.soundcloud.com/assets/logo_white-e5225cd1b2400b0a6afb7e9db54db9c118307bc0c7e35a55cd93da98769fd57f.png" width="72" alt="SoundCloud" /></a>}</div>
            {entry.soundcloud ? <SoundCloudMixPlayer url={entry.soundcloud} /> : entry.audio ? <Player src={entry.audio} artist={entry.artist} waveform={entry.waveform} /> : <a className="mix-external" href={entry.url} target="_blank" rel="noreferrer"><span>LISTEN ON ORIGINAL PLATFORM<small>Open the submitted link in a new tab</small></span></a>}
            <p className="mix-demo-note">{entry.note}</p>
            <div className="mix-card-bottom"><div className="mix-card-tools"><button className="mix-share" onClick={() => share(entry.id)}> SHARE MIX</button>{entry.source === "Upload" && entry.allowDownload && entry.originalFileUrl && <a className="mix-download" href={entry.originalFileUrl} download={entry.originalFilename} aria-label={`Download original file for ${entry.artist}`}> DOWNLOAD</a>}</div>{data?.verified ? <button className="mix-button mix-vote" disabled={!data.votingOpen || voteBusy} aria-pressed={vote === entry.id} onClick={() => void placeVote(entry.id)}>{vote === entry.id ? "✓ YOUR VOTE" : data.votingOpen ? "VOTE FOR THIS DJ" : "VOTING CLOSED"}</button> : <a className="mix-button mix-vote" href="/account/login?next=%2Fmusic%2Fcompetition">SIGN IN TO VOTE</a>}</div>
          </div>
        </article>)}</div>
        
        <p className="mix-notice" role="status">{notice}</p>
      </section>
      <aside className="mix-sidebar">
        <section className="mix-submit" id="submit-mix" aria-label="Submit your mix">
          <div className="mix-tabs" aria-label="Submission method">{["Upload", "Link"].map(item => <button key={item} type="button" aria-pressed={mode === item} onClick={() => { setMode(item); setFormMessage(""); }}>{item}</button>)}</div>
          {data && !data.verified && <p className="mix-account-prompt"><a href="/account/login?next=%2Fmusic%2Fcompetition">Sign in</a> or <a href="/account/signup?next=%2Fmusic%2Fcompetition">create an account</a> and verify your email to enter.</p>}
          {data?.hasEntry && <p className="mix-notice">Your entry has been received. Contact us if you need to change it.</p>}
          {data && !data.submissionsOpen && <p className="mix-notice">Submissions are closed.</p>}
          <form onSubmit={submit}><fieldset disabled={busy || !data?.verified || !data?.submissionsOpen || data?.hasEntry}>
            {mode === "Upload" ? <label className="mix-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}><strong>{file ? file.name : "Drop your audio here"}</strong><small>{file ? "Click to choose another file" : "or browse files"}</small><input type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" aria-label="Choose mix audio" onChange={event => chooseFile(event.target.files?.[0])} /><small>MP3, WAV, M4A · up to 200 MB</small></label> : <label className="mix-field">Mix link<input name="mix-link" type="url" placeholder="https://…" required /><small>Paste a public SoundCloud mix link.</small></label>}
            {mode === "Upload" && <label className="mix-download-option"><input type="checkbox" name="allowDownload" checked={allowDownload} onChange={event => setAllowDownload(event.target.checked)} /><span><strong>Make downloadable</strong><small>Let listeners download your original audio file.</small></span></label>}
            <label className="mix-field">Artist name<input name="artist" placeholder="Your DJ name" required maxLength={80} /></label>
            <label className="mix-field">Mix title<input name="title" placeholder="Give your mix a name" required maxLength={120} /></label>
            <div className="mix-form-row"><label className="mix-field">Genre<select name="genre" required defaultValue=""><option value="" disabled>Select genre</option>{MIX_GENRES.map(genre => <option key={genre}>{genre}</option>)}</select></label></div>
            <label className="mix-field">Email address<input name="email" type="email" placeholder="you@example.com" defaultValue={data?.email} required /></label>
            <button className="mix-button mix-submit-button" type="submit">{busy ? "SUBMITTING…" : "SUBMIT YOUR MIX"}</button></fieldset>
            <p role="status" className="mix-form-message">{formMessage}</p>
          </form>
        </section>
        <section className="mix-prize"><p className="mix-eyebrow">✳ THE PRIZE</p><h2>A SET AT<br />UPFORIT <em>NYE.</em></h2><div><strong>McCarthys · Bletchley</strong><span>31 December 2026</span></div><p>A new crowd. A proper sound system.<br />A New Year’s Eve to make your own.</p></section>
      </aside>
      <section className="mix-how" id="how-it-works"><p className="mix-eyebrow">FROM YOUR DECKS TO OUR STAGE</p><h2>MAKE YOURSELF HEARD.</h2><div>{[["01", "SUBMIT YOUR MIX", "Upload your mix or paste a SoundCloud link, and it’ll appear on the page straight away."], ["02", "LET THE CROWD DECIDE", "Listen, discover and vote. Sign in and confirm your email to vote. You can change your choice until voting closes."], ["03", "PLAY UPFORIT NYE", "The DJ with the most valid votes wins a set at our New Year’s Eve event. Submissions and voting close at 6pm UK time on 27 November 2026, when the winner will be announced."]].map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    </div>
  </div>;
}
