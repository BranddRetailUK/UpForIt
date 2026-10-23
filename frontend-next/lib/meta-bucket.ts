import { createHash } from "node:crypto";
import type { MetaJobInput } from "./meta-jobs";
import type { getMetaRequestContext } from "./meta";
import { BUCKET_PATH } from "./bucket-shared";

export type BucketTrackingContext = Pick<ReturnType<typeof getMetaRequestContext>, "consent"> &
  Partial<ReturnType<typeof getMetaRequestContext>>;

export function bucketRegistrationEvent(
  entryId: string,
  user: { id: string; email: string },
  context?: BucketTrackingContext
): MetaJobInput | null {
  if (!context?.consent) return null;
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.upforitevents.co.uk").replace(/\/+$/, "");
  return {
    eventName: "CompleteRegistration",
    eventId: `bucket_entry_${createHash("sha256").update(entryId).digest("hex").slice(0, 32)}`,
    eventSourceUrl: `${origin}${BUCKET_PATH}`,
    contentName: "Blackley's Bucket — NYE 2026",
    contentCategory: "bucket entry",
    userData: {
      email: user.email, externalId: user.id,
      fbp: context.fbp, fbc: context.fbc,
      clientIp: context.clientIp, clientUserAgent: context.clientUserAgent
    }
  };
}
