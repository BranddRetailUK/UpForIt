"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ticketLaunchRemaining, TICKET_LAUNCH_AT } from "../lib/ticket-launch-countdown";

export default function TicketLaunchCountdown() {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let lastRefresh = 0;
    const refresh = () => {
      const time = Date.now();
      if (time >= TICKET_LAUNCH_AT && time - lastRefresh >= 5000) {
        lastRefresh = time;
        router.refresh();
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  if (now !== null && now >= TICKET_LAUNCH_AT) return <span>Tickets opening soon</span>;
  const values = now === null ? [null, null, null, null] : ticketLaunchRemaining(now);
  return <span className="ticket-launch-countdown">
    <span className="ticket-launch-countdown__heading">TICKETS GO LIVE IN</span>
    <span className="ticket-launch-countdown__clock" role="timer" aria-live="off" aria-label="Countdown to Friday 23 October, midday UK time">
      {values.map((value, index) => <span className="ticket-launch-countdown__unit" key={index}><strong>{value === null ? "--" : String(value).padStart(2, "0")}</strong><small>{["Days", "Hours", "Mins", "Secs"][index]}</small></span>)}
    </span>
  </span>;
}
