import { TICKET_LAUNCH_AT } from "./ticket-launch-countdown";
/** Approved for the scheduled launch; the public switch remains an emergency stop. */
export const TICKET_LAUNCH_APPROVED = true;
export function ticketLaunchAllowed(now = Date.now()) {
  return process.env.APP_ENV === "testing" || (TICKET_LAUNCH_APPROVED && now >= TICKET_LAUNCH_AT);
}
