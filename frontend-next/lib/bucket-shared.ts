export const BUCKET_SLUG = "nye-2026";
export const BUCKET_PATH = "/events/nye-2026/blackleys-bucket";
export type BucketState = "upcoming" | "eligible" | "signed-out" | "no-ticket" | "entered" | "verify-email" | "closed" | "ticket-inactive" | "unavailable";
export type BucketStatus = { state: BucketState; djName?: string; entryStatus?: "entered" | "called" | "played" | "skipped" };
export class BucketError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateBucketEntry(body: unknown) {
  if (!body || typeof body !== "object") throw new BucketError("Enter your DJ name.");
  const { djName, consent } = body as Record<string, unknown>;
  if (typeof djName !== "string" || !djName.trim() || djName.trim().length > 80 || /[\x00-\x1f\x7f]/.test(djName)) {
    throw new BucketError("Enter a DJ name between 1 and 80 characters.");
  }
  if (consent !== true) throw new BucketError("Please confirm that a DJ slot is not guaranteed.");
  return djName.trim();
}
