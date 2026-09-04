import type { FlashLevel, TextAnimation, VisualJobV1 } from "./contracts";

const INTERVALS: Record<FlashLevel, number | null> = {
  off: null,
  low: 1.2,
  medium: 0.6,
  high: 0.6
};

export type SafetyReport = {
  version: 1;
  passed: boolean;
  generatedAt: string;
  deliberateFlashEvents: number[];
  maximumEventsInRollingSecond: number;
  saturatedRedUsed: false;
  limit: 2;
  note: string;
};

export function compileFlashEvents(
  level: FlashLevel,
  durationSeconds: number,
  textAnimation?: TextAnimation
) {
  if (textAnimation === "steady_glow" || level === "off") return [];
  const interval = INTERVALS[level];
  if (!interval) return [];
  const events: number[] = [];
  for (let time = 0.3; time < durationSeconds; time += interval) {
    events.push(Number(time.toFixed(3)));
  }
  return events;
}

export function maximumEventsInRollingSecond(events: number[]) {
  let maximum = 0;
  for (let start = 0; start < events.length; start += 1) {
    let count = 0;
    for (let index = start; index < events.length; index += 1) {
      if (events[index] - events[start] > 1) break;
      count += 1;
    }
    maximum = Math.max(maximum, count);
  }
  return maximum;
}

export function createSafetyReport(job: VisualJobV1): SafetyReport {
  const textAnimation = job.content.kind === "artist_batch" ? job.content.textAnimation : undefined;
  const events = compileFlashEvents(job.motion.flashLevel, job.canvas.durationSeconds, textAnimation);
  const maximum = maximumEventsInRollingSecond(events);
  return {
    version: 1,
    passed: maximum <= 2,
    generatedAt: new Date().toISOString(),
    deliberateFlashEvents: events,
    maximumEventsInRollingSecond: maximum,
    saturatedRedUsed: false,
    limit: 2,
    note: "Conservative deterministic preflight only; this is not formal photosensitive-epilepsy certification."
  };
}
