"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { TICKET_LAUNCH_AT } from "../../../../lib/ticket-launch-countdown";

import { BUCKET_PATH, type BucketState, type BucketStatus, validateBucketEntry } from "../../../../lib/bucket-shared";
import { useMetaTracking } from "../../../../components/MetaTrackingProvider";

export default function BucketPage({initial,preview=false,account}:{initial:BucketStatus;preview?:boolean;account?:{fullName:string;email:string}}) {
  const { track } = useMetaTracking();
  const [state, setState] = useState<BucketState>(initial.state);
  const [djName, setDjName] = useState(initial.djName||"");
  const [fullName,setFullName]=useState(account?.fullName||"");
  const [phone,setPhone]=useState("");
  const [attendance,setAttendance]=useState(false);
  const [entryStatus,setEntryStatus]=useState(initial.entryStatus);
  const [busy,setBusy]=useState(false);
  const [ticketPrompt,setTicketPrompt]=useState(false);
  const ticketPromptRef=useRef<HTMLDivElement>(null);
  function applyStatus(data:BucketStatus){setState(data.state);setEntryStatus(data.entryStatus);if(data.djName)setDjName(data.djName);}
  useEffect(()=>{
    if(preview)return;
    let active=true;
    async function refresh(){try{const r=await fetch('/api/bucket',{cache:'no-store'});if(r.ok&&active)applyStatus(await r.json());}catch{/* Keep the rendered state; submission always rechecks. */}}
    window.addEventListener('focus',refresh);
    let lastRefresh=0;
    const checkLaunch=()=>{const now=Date.now();if(state==='upcoming'&&now>=TICKET_LAUNCH_AT&&now-lastRefresh>=5000){lastRefresh=now;void refresh();}};
    checkLaunch();
    const timer=state==='upcoming'?window.setInterval(checkLaunch,1000):undefined;
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[preview,state]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const eligible = state === "eligible";
  const showForm = eligible || state === "no-ticket";
  const entered = state === "entered";
  const cta = state === "upcoming" ? "ENTRIES OPENING SOON" : state === "closed" ? "ENTRIES CLOSED" : state === "unavailable" ? "CHECK ENTRY STATUS" : state === "verify-email" ? "VERIFY YOUR EMAIL" : state === "ticket-inactive" ? "CHECK YOUR TICKET" : state === "signed-out" ? "SIGN IN TO ENTER" : entered ? "YOU’RE ENTERED" : "ENTER THE BUCKET";

  function changeState(value: BucketState) {
    setState(value);
    setTicketPrompt(false);
    setDjName("");
    setConsent(false);
    setAttendance(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (state === "no-ticket") {
      setTicketPrompt(true);
      requestAnimationFrame(()=>ticketPromptRef.current?.focus());
      return;
    }
    if (!eligible) return;
    const name = djName.trim();
    try { validateBucketEntry({djName:name,fullName,phone,attendance,consent}); }
    catch(e) { setError(e instanceof Error ? e.message : "Check your entry details."); return; }
    setDjName(name);
    setError("");
    if(preview){setState("entered");requestAnimationFrame(()=>resultRef.current?.focus());return;}
    setBusy(true);
    try{
      const r=await fetch('/api/bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({djName:name,fullName,phone,attendance,consent})});
      const data=await r.json();
      if(!r.ok){
        const latest=await fetch('/api/bucket',{cache:'no-store'});
        if(latest.ok)applyStatus(await latest.json());
        throw new Error(data.error||'Unable to save your entry. Please try again.');
      }
      applyStatus(data);
      if (data.state === "entered" && data.meta?.eventId) {
        try {
          track("CompleteRegistration", {content_name:"Blackley's Bucket — NYE 2026",content_category:"bucket entry",status:true},data.meta.eventId);
        } catch { /* Measurement must not prevent the saved entry confirmation. */ }
      }
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
              <span className="bucket-logo-row"><span className="bucket-cre8 bucket-hero-cre8" role="img" aria-label="CRE8#DNB, Blackley’s label" /><Image src="/brand/nye-2026/blackley-logo.png" alt="Blackley’s" width={2835} height={587} className="bucket-blackley-logo" priority /><span className="bucket-cre8 bucket-hero-cre8 bucket-cre8-right" aria-hidden="true" /></span>
              <Image src="/brand/blackleys-bucket/bucket-wordmark.png" alt="Bucket" width={2172} height={724} className="bucket-wordmark" priority />
            </h1>
            <p className="bucket-tagline">YOUR CHANCE TO PLAY AT NYE <em>2026</em></p>
            <ul className="bucket-stats" aria-label="Draw details"><li><strong>8</strong> DJs</li><li><strong>15</strong> MINUTES</li><li><strong>LIVE</strong> DRAW</li></ul>
            <a className="industrial-button bucket-button bucket-hero-button" href={state === "signed-out" ? `/account/login?next=${encodeURIComponent(BUCKET_PATH)}` : "#bucket-entry"}>{cta}</a>
          </div>
        </div>
      </section>

      <div className="bucket-event-strip"><div className="section-wrap bucket-wrap"><span>31 DEC 2026</span><i aria-hidden="true">•</i><span>McCARTHYS, BLETCHLEY</span><i aria-hidden="true">•</i><span>DOORS OPEN 5PM</span></div></div>

      <section className="section-wrap bucket-wrap bucket-entry" id="bucket-entry" aria-labelledby="bucket-entry-title">
        <div className="bucket-entry-copy">
          <h2 id="bucket-entry-title"><span className="bucket-your-name">YOUR NAME<em>.</em></span><br /><em>IN THE BUCKET<span className="bucket-white-stop">.</span></em></h2>
          <p className="bucket-entry-intro">Start your New Year’s Eve behind the decks. Blackley’s picking eight DJs at random to play a 15-minute set during the opening two hours.</p>
          <div className="bucket-arrival"><div><h3>BE THERE AT <span className="bucket-arrival-time">5PM</span>.</h3><p>Bring your USB. Be ready when called.</p><p>The draw runs from 5–7pm, so get down for doors and make sure you don’t miss your name being called.</p></div></div>
        </div>
        <div className="bucket-form-panel">
          {!showForm && error && <p className="bucket-error" role="alert">{error}</p>}
          {showForm ? <>
            {eligible && <p className="bucket-eligibility"><span aria-hidden="true">✓</span> Ticket confirmed</p>}
            <form onSubmit={submit}>
              <label className="bucket-field" htmlFor="bucket-dj-name">Artist / DJ name</label>
              <input id="bucket-dj-name" name="djName" placeholder="Your DJ name" autoComplete="nickname" maxLength={80} required value={djName} onChange={event => { setDjName(event.target.value); setError(""); }} aria-describedby={error ? "bucket-error" : undefined} aria-invalid={!!error} />
              <label className="bucket-field" htmlFor="bucket-full-name">Full name</label>
              <input id="bucket-full-name" name="fullName" placeholder="Your full name" autoComplete="name" maxLength={120} required value={fullName} onChange={event => setFullName(event.target.value)} />
              <label className="bucket-field" htmlFor="bucket-email">Email</label>
              <input id="bucket-email" name="email" type="email" autoComplete="email" value={account?.email||""} readOnly aria-describedby="bucket-email-help" />
              <p className="bucket-field-help" id="bucket-email-help">{eligible ? "Your account email, linked to your website ticket." : "Your account email."}</p>
              <label className="bucket-field" htmlFor="bucket-phone">Phone number <span className="bucket-optional">(optional)</span></label>
              <input id="bucket-phone" name="phone" type="tel" autoComplete="tel" placeholder="Your phone number" maxLength={30} value={phone} onChange={event => setPhone(event.target.value)} />
              <label className="bucket-consent"><input type="checkbox" required checked={attendance} onChange={event => setAttendance(event.target.checked)} /><span>I confirm I will be present at the event if selected.</span></label>
              <label className="bucket-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I understand a DJ slot is not guaranteed.</span></label>
              {error && <p id="bucket-error" className="bucket-error" role="alert">{error}</p>}
              <button className="industrial-button bucket-button" type="submit" formNoValidate={state === "no-ticket"} disabled={busy}>{busy ? "SAVING YOUR ENTRY…" : "ENTER THE BUCKET"}</button>
            </form>
            {state === "no-ticket" && ticketPrompt && <div className="bucket-ticket-prompt bucket-gated" role="region" aria-labelledby="bucket-ticket-prompt-title" tabIndex={-1} ref={ticketPromptRef}>
              <h3 id="bucket-ticket-prompt-title">GET YOUR TICKET.</h3>
              <p>You need an NYE ticket to enter Blackley’s Bucket. Buy your ticket, then come back to submit your entry.</p>
              <Link className="industrial-button bucket-button" href="/events/nye-2026">BUY A TICKET</Link>
            </div>}
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
        <section className="bucket-details" aria-label="How it works">
          <div className="bucket-rules"><p><strong>8 DJs. 15 minutes each.</strong> Blackley draws names at random during the first two hours, from 5–7pm.</p><p><strong>Be there when you’re called.</strong> If you’re missing, another name is drawn. Selected names are removed from the bucket.</p><p><strong>Bring your USB.</strong> One entry per person with a valid NYE ticket. Entry is optional.</p></div>
        </section>
      </div>
      <section className="section-wrap bucket-wrap bucket-recording" aria-labelledby="bucket-recording-title">
        <div className="bucket-recording-badge"><span aria-hidden="true" /> AUDIO + VIDEO</div>
        <h2 id="bucket-recording-title">TWO HOURS.<br /><em>ALL RECORDED.</em></h2>
        <p>The full two hours of Blackley’s Bucket, from <strong>5–7pm</strong>, will be recorded on audio and video.</p>
        <p className="bucket-recording-release">All content will be available after the event.</p>
      </section>

    </div>
  );
}
