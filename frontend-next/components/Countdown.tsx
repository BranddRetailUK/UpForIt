"use client";

import { useEffect, useState } from "react";

type CountdownProps = {
  target: string;
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

const clamp = (value: number) => (value < 0 ? 0 : value);

const getTimeLeft = (target: string): TimeLeft => {
  const now = Date.now();
  const end = new Date(target).getTime();
  const diff = end - now;

  if (Number.isNaN(end)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: clamp(days),
    hours: clamp(hours),
    minutes: clamp(minutes),
    seconds: clamp(seconds),
    done: false
  };
};

const pad = (value: number) => value.toString().padStart(2, "0");

export default function Countdown({ target }: CountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeft(target));

  useEffect(() => {
    setMounted(true);
    const tick = () => setTimeLeft(getTimeLeft(target));
    const interval = setInterval(tick, 1000);
    tick();
    return () => clearInterval(interval);
  }, [target]);

  return (
    <div className="countdown" role="timer" aria-live="polite">
      <div className="countdown__row">
        <div className="time-box">
          <span className="time-box__value">
            {mounted ? pad(timeLeft.days) : "--"}
          </span>
          <span className="time-box__label">Days</span>
        </div>
        <div className="time-box">
          <span className="time-box__value">
            {mounted ? pad(timeLeft.hours) : "--"}
          </span>
          <span className="time-box__label">Hours</span>
        </div>
        <div className="time-box">
          <span className="time-box__value">
            {mounted ? pad(timeLeft.minutes) : "--"}
          </span>
          <span className="time-box__label">Minutes</span>
        </div>
        <div className="time-box">
          <span className="time-box__value">
            {mounted ? pad(timeLeft.seconds) : "--"}
          </span>
          <span className="time-box__label">Seconds</span>
        </div>
      </div>
    </div>
  );
}
