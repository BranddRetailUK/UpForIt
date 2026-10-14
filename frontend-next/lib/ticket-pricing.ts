/** Quantity always means admissions, including free tickets. Offer repeats per order. */
export function ticketPrice(eventSlug: string, unitPriceMinor: number, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new Error("Invalid ticket price or quantity.");
  }
  if (eventSlug === "nye-2026" && unitPriceMinor !== 1000) {
    throw new Error("NYE tickets must be configured at £10.");
  }
  const freeQuantity = eventSlug === "nye-2026" ? Math.floor(quantity / 4) : 0;
  return {
    quantity,
    freeQuantity,
    paidQuantity: quantity - freeQuantity,
    subtotalMinor: quantity * unitPriceMinor,
    discountMinor: freeQuantity * unitPriceMinor,
    totalMinor: (quantity - freeQuantity) * unitPriceMinor
  };
}

export function ticketPriceLines(eventSlug: string, name: string, unitPriceMinor: number, quantity: number) {
  const price = ticketPrice(eventSlug, unitPriceMinor, quantity);
  return [
    { name, unitPriceMinor, quantity: price.paidQuantity },
    { name: `${name} — group offer (free)`, unitPriceMinor: 0, quantity: price.freeQuantity }
  ].filter(line => line.quantity > 0);
}
