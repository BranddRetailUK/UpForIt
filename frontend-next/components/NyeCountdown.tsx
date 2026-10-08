"use client";

import { useEffect, useState } from "react";

// Midnight at the end of New Year's Eve, in Europe/London (GMT).
const NEW_YEAR = Date.parse("2027-01-01T00:00:00Z");

export default function NyeCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((NEW_YEAR - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const values = remaining === null ? [null, null, null, null] : [
    Math.floor(remaining / 86400),
    Math.floor(remaining / 3600) % 24,
    Math.floor(remaining / 60) % 60,
    remaining % 60
  ];

  return (
    <div className="nye-countdown" role="timer" aria-label="Countdown to midnight, 1 January 2027, UK time" aria-live="off">
      {values.map((value, index) => (
        <div className="nye-countdown__unit" key={index}>
          {index > 0 && <span className="nye-countdown__dots" aria-hidden="true">:</span>}
          <span className="nye-countdown__number">{value === null ? "--" : String(value).padStart(2, "0")}</span>
          <span className="nye-countdown__label">{["Days", "Hours", "Mins", "Secs"][index]}</span>
        </div>
      ))}
    </div>
  );
}
