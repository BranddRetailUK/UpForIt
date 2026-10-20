"use client";

import { useRef, useState, type FormEvent } from "react";

const storageKey = "upforit-nye-2026-dj-draw-demo";

export default function DjDraw() {
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const entry = {
      djName: String(form.get("djName") || "").trim(),
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim().toLowerCase(),
      style: String(form.get("style") || ""),
      link: String(form.get("link") || "").trim(),
      createdAt: new Date().toISOString()
    };
    if (!entry.djName || !entry.email) {
      setError("Please add your DJ name and email address.");
      return;
    }
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const entries: typeof entry[] = Array.isArray(stored) ? stored : [];
      if (entries.some(item => item && item.email === entry.email)) {
        setError("There’s already a demo entry with this email in this browser. Your name is in the hat!");
        return;
      }
      localStorage.setItem(storageKey, JSON.stringify([...entries, entry]));
      setEntered(entry.djName);
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setError("Your browser couldn’t save this demo entry. Please enable local storage and try again.");
    }
  }

  return (
    <div className="dj-draw">
      <div className="draw-preview">LOCAL DEMO — NOT A LIVE ENTRY FORM</div>
      <div className="draw-simple-layout">
        <section className="draw-simple-copy" aria-labelledby="draw-title">
          <div className="draw-collab"><strong>UPFORIT</strong><span>×</span><strong>CRE8DNB</strong></div>
          <p className="draw-eyebrow">NEW YEAR’S EVE · DJ DRAW</p>
          <h1 id="draw-title">YOUR NAME.<br />THE HAT.<br /><em>THE DECKS.</em></h1>
          <p className="draw-intro">Get your name in the hat for a <strong>15-minute set</strong>, drawn on the spot during the <strong>first two hours</strong> of NYE.</p>
          <div className="draw-simple-date"><span>31.12.26</span><span>McCARTHYS<br />BLETCHLEY</span></div>
        </section>
        <section className="draw-form-panel" id="enter-draw" aria-labelledby="draw-form-title">
          {entered ? <div className="draw-success" role="status" tabIndex={-1} ref={resultRef}><span className="draw-success-icon">✓</span><p className="draw-eyebrow">DEMO ENTRY SAVED</p><h2>{entered},<br />YOU’RE IN<br /><em>THE HAT.</em></h2><p>Your entry is saved in this browser for the local preview. It hasn’t been sent to the organisers or entered into a live draw.</p><button className="draw-button" onClick={() => setEntered("")}>BACK TO THE FORM </button></div> : <><h2 id="draw-form-title">GET IN <em>THE HAT.</em></h2><form onSubmit={submit}>
            <label htmlFor="dj-name">DJ NAME<input id="dj-name" name="djName" placeholder="The name we’ll call out" required maxLength={80} autoComplete="nickname" /></label>
            <label htmlFor="dj-email">EMAIL ADDRESS<input id="dj-email" name="email" type="email" placeholder="you@example.com" required maxLength={254} autoComplete="email" /></label>
            <label className="draw-consent"><input name="ready" type="checkbox" required /><span>I’ll be there and ready to play. I understand a set isn’t guaranteed.</span></label>
            {error && <p className="draw-error" role="alert">{error}</p>}
            <button className="draw-button" type="submit">PUT MY NAME IN THE HAT </button>

          </form></>}
        </section>
      </div>

    </div>
  );
}
