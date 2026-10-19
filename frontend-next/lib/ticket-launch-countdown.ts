// Friday 23 October 2026, 08:00 Europe/London (BST, UTC+1).
// Display only: expiry never changes the ticket sales gates.
export const TICKET_LAUNCH_AT = Date.parse("2026-10-23T08:00:00+01:00");
export function ticketLaunchRemaining(now: number) {
  const seconds = Math.max(0, Math.ceil((TICKET_LAUNCH_AT - now) / 1000));
  return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
}
