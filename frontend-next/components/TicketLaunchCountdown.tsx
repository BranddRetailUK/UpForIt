"use client";
import { useEffect, useState } from "react";
import { ticketLaunchRemaining, TICKET_LAUNCH_AT } from "../lib/ticket-launch-countdown";

export default function TicketLaunchCountdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (now !== null && now >= TICKET_LAUNCH_AT) return <span>Tickets opening soon</span>;
  const values = now === null ? [null, null, null, null] : ticketLaunchRemaining(now);
  return <span className="ticket-launch-countdown">
    <span className="ticket-launch-countdown__heading">TICKETS GO LIVE IN</span>
    <span className="ticket-launch-countdown__clock" role="timer" aria-live="off" aria-label="Countdown to Friday 23 October, 8am UK time">
      {values.map((value, index) => <span className="ticket-launch-countdown__unit" key={index}><strong>{value === null ? "--" : String(value).padStart(2, "0")}</strong><small>{["Days", "Hours", "Mins", "Secs"][index]}</small></span>)}
    </span>
    <span className="ticket-launch-countdown__date">FRIDAY 23 OCTOBER · 8AM UK TIME</span>
  </span>;
}
