"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { FormEvent, useEffect, useRef, useState } from "react";

type TicketResult = {
  ticket_number: string; ticket_type_name: string; status: string; checked_in_at: string | null;
  display_name: string; event_title: string;
};

export default function AdminCheckIn({ events = [], fixedEventId }: {events?: Array<{id:string;title:string}>;fixedEventId?:string}) {
  const [eventId, setEventId] = useState(fixedEventId || events[0]?.id || "");
  const inFlight = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; ticket?: TicketResult } | null>(null);

  async function checkIn(code: string) {
    if (inFlight.current || !eventId) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/check-in", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, eventId })
      });
      const result = await response.json() as { ok?: boolean; error?: string; ticket?: TicketResult };
      setMessage({ ok: response.ok, text: response.ok ? "Ticket checked in" : result.error || "Check-in failed", ticket: result.ticket });
    } catch {
      setMessage({ ok: false, text: "Connection lost. Check the signal and try this ticket again." });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!scanning || !video.current) return;
    let cancelled = false;
    const reader = new BrowserQRCodeReader();
    reader.decodeFromVideoDevice(undefined, video.current, (result) => {
      if (!cancelled && result) {
        controls.current?.stop();
        setScanning(false);
        void checkIn(result.getText());
      }
    }).then((value) => { controls.current = value; }).catch(() => {
      setMessage({ ok: false, text: "Camera access failed. Use the ticket number instead." });
      setScanning(false);
    });
    return () => { cancelled = true; controls.current?.stop(); controls.current = null; };
  // checkIn intentionally reads the latest busy state after a scan.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, eventId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get("code") || "");
    void checkIn(code);
    event.currentTarget.reset();
  }

  return (
    <div className="check-in-tool">
      {!fixedEventId ? <label>Event<select value={eventId} disabled={busy || scanning} onChange={event=>setEventId(event.target.value)}>{events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></label> : null}
      {!eventId ? <p>No event is currently open for check-in.</p> : null}
      <button className="pop-button pop-button--yellow" type="button" disabled={busy || !eventId} onClick={() => setScanning((value) => !value)}>
        {scanning ? "Stop camera" : "Scan QR code"}
      </button>
      {scanning ? <video className="check-in-video" ref={video} muted playsInline /> : null}
      <form className="check-in-manual" onSubmit={submit}>
        <label>Or enter ticket number<input name="code" placeholder="UFI-T-010001" autoComplete="off" required /></label>
        <button className="pop-button pop-button--pink" type="submit" disabled={busy || !eventId}>{busy ? "Checking…" : "Check in"}</button>
      </form>
      {message ? (
        <div className={`check-in-result ${message.ok ? "is-success" : "is-error"}`} role="status">
          <strong>{message.text}</strong>
          {message.ticket ? <p>{message.ticket.display_name} · {message.ticket.ticket_type_name}<br />{message.ticket.ticket_number} · {message.ticket.event_title}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
