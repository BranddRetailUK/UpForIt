/** Enable only when the next event and its artwork are ready to announce. */
export function publicTicketSalesOpen() {
  return process.env.PUBLIC_TICKET_SALES_OPEN === "true";
}
