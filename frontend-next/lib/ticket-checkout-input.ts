export class TicketRequestError extends Error {
  constructor(message: string, public status = 400, public details: Record<string,unknown> = {}) { super(message); }
}
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseGuestBuyer(value: unknown) {
  if (!value || typeof value !== 'object') throw new TicketRequestError('Enter your name and email to check out as a guest.');
  const guest = value as Record<string, unknown>;
  const name = typeof guest.name === 'string' ? guest.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof guest.email === 'string' ? guest.email.trim().toLowerCase() : '';
  if (name.length < 2 || name.length > 80 || /[\x00-\x1f\x7f]/.test(name)) throw new TicketRequestError('Enter your full name (2–80 characters).');
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TicketRequestError('Enter a valid email address.');
  return {name, email};
}
export function parseTicketCheckout(value: unknown) {
  if (!value || typeof value !== 'object') throw new TicketRequestError('Choose valid tickets.');
  const body = value as Record<string, unknown>;
  if (typeof body.idempotencyKey !== 'string' || !/^[a-zA-Z0-9:_-]{16,100}$/.test(body.idempotencyKey)) throw new TicketRequestError('Invalid checkout reference.');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 10) throw new TicketRequestError('Choose valid tickets.');
  const ids = new Set<string>();
  const items = body.items.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new TicketRequestError('Choose valid tickets.');
    const row = item as Record<string, unknown>;
    if (typeof row.ticketTypeId !== 'string' || !UUID_PATTERN.test(row.ticketTypeId) || !Number.isSafeInteger(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > 100) throw new TicketRequestError('Choose a valid ticket quantity.');
    const id = row.ticketTypeId.toLowerCase();
    if (ids.has(id)) throw new TicketRequestError('Choose each ticket type once.');
    ids.add(id);
    return { ticketTypeId: id, quantity: Number(row.quantity) };
  }).sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId));
  return { items, idempotencyKey: body.idempotencyKey, meta: body.meta, guest: body.guest, guestToken: body.guestToken };
}
