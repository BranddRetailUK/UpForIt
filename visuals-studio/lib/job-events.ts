import { EventEmitter } from "node:events";
import type { JobEvent } from "./contracts";

const globalState = globalThis as typeof globalThis & {
  __upforitJobEvents?: EventEmitter;
};

export const jobEvents = globalState.__upforitJobEvents || new EventEmitter();
jobEvents.setMaxListeners(200);
if (process.env.NODE_ENV !== "production") globalState.__upforitJobEvents = jobEvents;

export function emitJobEvent(event: JobEvent) {
  jobEvents.emit(event.jobId, event);
}
