import { ticketLaunchAllowed } from "./ticket-launch";
/** Enable only when the next event and its artwork are ready to announce. */
export function publicTicketSalesOpen() {
  return ticketLaunchAllowed() && process.env.PUBLIC_TICKET_SALES_OPEN === "true";
}
