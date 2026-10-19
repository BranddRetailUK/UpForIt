export const BUCKET_SLUG = "nye-2026";
export const BUCKET_PATH = "/events/nye-2026/blackleys-bucket";
export type BucketState = "upcoming" | "eligible" | "signed-out" | "no-ticket" | "entered" | "verify-email" | "closed" | "ticket-inactive" | "unavailable";
export type BucketStatus = { state: BucketState; djName?: string; entryStatus?: "entered" | "called" | "played" | "skipped" };
export type BucketEntryDetails = { djName: string; fullName: string; phone: string | null; attendance: true };
export class BucketError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateBucketEntry(body: unknown) {
  if (!body || typeof body !== "object") throw new BucketError("Enter your DJ name.");
  const { djName, consent, fullName, phone, attendance } = body as Record<string, unknown>;
  if (typeof djName !== "string" || !djName.trim() || djName.trim().length > 80 || /[\x00-\x1f\x7f]/.test(djName)) {
    throw new BucketError("Enter a DJ name between 1 and 80 characters.");
  }
  if (consent !== true) throw new BucketError("Please confirm that a DJ slot is not guaranteed.");
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 120 || /[\x00-\x1f\x7f]/.test(fullName)) {
    throw new BucketError("Enter your full name (up to 120 characters).");
  }
  if (phone != null && (typeof phone !== "string" || (phone.trim() && (!/^[+0-9 ().-]{7,30}$/.test(phone.trim()) || phone.replace(/\D/g, "").length < 7)))) {
    throw new BucketError("Enter a valid phone number or leave it blank.");
  }
  if (attendance !== true) throw new BucketError("Please confirm you will be present at the event if selected.");
  return { djName: djName.trim(), fullName: fullName.trim(), phone: typeof phone === "string" ? phone.trim() || null : null, attendance: true } satisfies BucketEntryDetails;
}
