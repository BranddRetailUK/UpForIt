/** Deliberate release lock: change only after the launch checklist is signed off. */
export const TICKET_LAUNCH_APPROVED = false;
export function ticketLaunchAllowed() {
  return TICKET_LAUNCH_APPROVED || process.env.APP_ENV === "testing";
}
