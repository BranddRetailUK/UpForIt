"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { BUCKET_PATH, type BucketState, type BucketStatus } from "../../../../lib/bucket-shared";

export default function BucketPage({initial,preview=false}:{initial:BucketStatus;preview?:boolean}) {
  const [state, setState] = useState<BucketState>(initial.state);
  const [djName, setDjName] = useState(initial.djName||"");
  const [entryStatus,setEntryStatus]=useState(initial.entryStatus);
  const [busy,setBusy]=useState(false);
  function applyStatus(data:BucketStatus){setState(data.state);setEntryStatus(data.entryStatus);if(data.djName)setDjName(data.djName);}
  useEffect(()=>{
    if(preview)return;
    let active=true;
    async function refresh(){try{const r=await fetch('/api/bucket',{cache:'no-store'});if(r.ok&&active)applyStatus(await r.json());}catch{/* Keep the rendered state; submission always rechecks. */}}
    window.addEventListener('focus',refresh);
    return()=>{active=false;window.removeEventListener('focus',refresh);};
  },[preview]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const eligible = state === "eligible";
  const entered = state === "entered";
  const cta = state === "upcoming" ? "ENTRIES OPENING SOON" : state === "closed" ? "ENTRIES CLOSED" : state === "unavailable" ? "CHECK ENTRY STATUS" : state === "verify-email" ? "VERIFY YOUR EMAIL" : state === "ticket-inactive" ? "CHECK YOUR TICKET" : state === "signed-out" ? "SIGN IN TO ENTER" : state === "no-ticket" ? "GET A TICKET" : entered ? "YOU’RE ENTERED" : "ENTER THE BUCKET";

  function changeState(value: BucketState) {
    setState(value);
    setDjName("");
    setConsent(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligible || busy) return;
    const name = djName.trim();
    if (!name) { setError("Add your DJ name to enter the bucket."); return; }
    if (!consent) { setError("Please confirm that a DJ slot is not guaranteed."); return; }
    setDjName(name);
    setError("");
    if(preview){setState("entered");requestAnimationFrame(()=>resultRef.current?.focus());return;}
    setBusy(true);
    try{
      const r=await fetch('/api/bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({djName:name,consent})});
      const data=await r.json();
      if(!r.ok){
        const latest=await fetch('/api/bucket',{cache:'no-store'});
        if(latest.ok)applyStatus(await latest.json());
        throw new Error(data.error||'Unable to save your entry. Please try again.');
      }
      applyStatus(data);
      requestAnimationFrame(()=>resultRef.current?.focus());
    }catch(e){setError(e instanceof Error?e.message:'Unable to save your entry. Please try again.');}
    finally{setBusy(false);}
  }

  return (
    <div className="bucket-page">
      {preview && <aside className="bucket-preview" aria-label="Local preview controls">
        <span><i aria-hidden="true" /> LOCAL PREVIEW <span className="bucket-preview-note">· Entries aren’t submitted</span></span>
        <label>View as <select aria-label="Preview account state" value={state} onChange={event => changeState(event.target.value as BucketState)}>
          <option value="eligible">Ticket holder</option><option value="signed-out">Signed out</option><option value="no-ticket">No ticket</option><option value="entered">Already entered</option>
        </select></label>
      </aside>}

      <section className="bucket-hero" aria-labelledby="bucket-title">
        <div className="bucket-hero-photo" aria-hidden="true" />
        <div className="bucket-hero-shade" aria-hidden="true" />
        <div className="section-wrap bucket-wrap bucket-hero-inner">
          <div className="bucket-hero-copy">
            <h1 id="bucket-title" aria-label="Blackley’s Bucket">
              <Image src="/brand/nye-2026/blackley-logo.png" alt="Blackley’s" width={2835} height={587} className="bucket-blackley-logo" priority />
              <span>BUCKET.</span>
            </h1>
            <p className="bucket-tagline">YOUR CHANCE TO PLAY AT NYE.</p>
            <ul className="bucket-stats" aria-label="Draw details"><li><strong>8</strong> DJs</li><li><strong>15</strong> MINUTES EACH</li><li>LIVE DRAWER</li></ul>
            <a className="industrial-button bucket-button bucket-hero-button" href={state === "no-ticket" ? "/events/nye-2026" : "#bucket-entry"}>{cta}</a>
          </div>
          <div className="bucket-label-brand">
            <div className="bucket-cre8" role="img" aria-label="CRE8#DNB, Blackley’s label" />
          </div>
        </div>
      </section>

      <div className="bucket-event-strip"><div className="section-wrap bucket-wrap"><span>31 DEC 2026</span><i aria-hidden="true">✳</i><span>McCARTHYS, BLETCHLEY</span><i aria-hidden="true">✳</i><span>DOORS OPEN 5PM</span></div></div>

      <section className="section-wrap bucket-wrap bucket-entry" id="bucket-entry" aria-labelledby="bucket-entry-title">
        <div className="bucket-entry-copy">
          <h2 id="bucket-entry-title"><span className="bucket-your-name">YOUR NAME<em>.</em></span><br /><em>IN THE BUCKET<span className="bucket-white-stop">.</span></em></h2>
          <p className="bucket-entry-intro">Start your New Year’s Eve behind the decks. Blackley’s picking eight DJs at random to play a 15-minute set during the opening two hours.</p>
          <div className="bucket-arrival"><div><h3>BE THERE AT 5PM.</h3><p>Bring your USB. Be ready when called.</p><p>The draw runs from 5–7pm, so get down for doors and make sure you don’t miss your name being called.</p></div></div>
        </div>
        <div className="bucket-form-panel">
          {!eligible && error && <p className="bucket-error" role="alert">{error}</p>}
          {eligible ? <>
            <p className="bucket-eligibility"><span aria-hidden="true">✓</span> Ticket confirmed</p>
            <form onSubmit={submit}>
              <label className="bucket-field" htmlFor="bucket-dj-name">DJ name</label>
              <input id="bucket-dj-name" name="djName" placeholder="Your DJ name" autoComplete="nickname" maxLength={80} required value={djName} onChange={event => { setDjName(event.target.value); setError(""); }} aria-describedby={error ? "bucket-error" : undefined} aria-invalid={!!error} />
              <label className="bucket-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I understand a DJ slot is not guaranteed.</span></label>
              {error && <p id="bucket-error" className="bucket-error" role="alert">{error}</p>}
              <button className="industrial-button bucket-button" type="submit" disabled={busy}>{busy ? "SAVING YOUR ENTRY…" : "ENTER THE BUCKET"}</button>
            </form>
          </> : entered ? <div className="bucket-success" role="status" tabIndex={-1} ref={resultRef}>
            <span className="bucket-success-check" aria-hidden="true">✓</span>
            <h3>YOU’RE IN<br /><em>THE BUCKET.</em></h3>
            <p>{djName ? <><strong>{djName}</strong>, be there at 5pm with your USB ready.</> : "Be there at 5pm with your USB ready."}</p>
            <p className="bucket-small">{entryStatus==='called' ? 'Your name has been called — head to the decks.' : entryStatus==='played' ? 'Your DJ slot has been confirmed.' : entryStatus==='skipped' ? 'Your name was called and skipped. You are no longer in the draw.' : 'Your entry is saved. The next move is Blackley’s.'}</p>
          </div> : ['upcoming','closed','verify-email','ticket-inactive','unavailable'].includes(state) ? <div className="bucket-gated">
            <h3>{state==='upcoming'?'ENTRIES OPENING SOON.':state==='closed'?'ENTRIES CLOSED.':state==='verify-email'?'VERIFY YOUR EMAIL.':state==='ticket-inactive'?'CHECK YOUR TICKET.':'BACK SOON.'}</h3>
            <p>{state==='upcoming'?'Entry will open when NYE tickets launch. Check the event page for ticket updates.':state==='closed'?'Entries close when doors open. Thanks for being part of UPFORIT NYE.':state==='verify-email'?'Verify your account email, then come back to enter the bucket.':state==='ticket-inactive'?'Your entry is saved, but your NYE ticket is not currently valid for the draw. Check your tickets or contact us for help.':'We can’t check ticket eligibility right now. Please refresh this page shortly.'}</p>
            {state==='upcoming'&&<Link className="industrial-button bucket-button" href="/events/nye-2026">VIEW EVENT</Link>}
            {state!=='upcoming'&&state!=='closed'&&state!=='unavailable'&&<Link className="industrial-button bucket-button" href={state==='verify-email'?`/account/login?next=${encodeURIComponent(BUCKET_PATH)}`:'/account'}>{state==='verify-email'?'VERIFY ACCOUNT':'VIEW TICKETS'}</Link>}
          </div> : <div className="bucket-gated">
            <h3>{state === "signed-out" ? "GOT YOUR TICKET?" : "GET YOUR TICKET."}</h3>
            <p>{state === "signed-out" ? "Sign in to check your ticket and enter the bucket." : "An NYE ticket gets you through the door — and into the draw."}</p>
            <Link className="industrial-button bucket-button" href={state === "signed-out" ? "/account/login?next=%2Fevents%2Fnye-2026%2Fblackleys-bucket" : "/events/nye-2026"}>{state === "signed-out" ? "SIGN IN" : "GET A TICKET"}</Link>
          </div>}
        </div>
      </section>

      <div className="section-wrap bucket-wrap bucket-details-wrap">
        <section className="bucket-details" aria-labelledby="bucket-how-title"><h2 id="bucket-how-title" className="bucket-how-title">HOW IT WORKS</h2>
          <div className="bucket-rules"><p><strong>8 DJs. 15 minutes each.</strong> Blackley draws names at random during the first two hours, from 5–7pm.</p><p><strong>Be there when you’re called.</strong> If you’re missing, another name is drawn. Selected names are removed from the bucket.</p><p><strong>Bring your USB.</strong> One entry per person with a valid NYE ticket. Entry is optional.</p></div>
        </section>
      </div>
    </div>
  );
}
