import { createHmac, timingSafeEqual } from "node:crypto";
import { sha256 } from "./security";
export const GUEST_COOKIE = "upforit_guest_checkout";
export function guestAccessHash(token: unknown): string | null {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token) ? sha256(token) : null;
}
export function canAccessGuestOrder(order: {user_id: string | null; guest_access_hash: string | null}, token: unknown) {
  const actual = guestAccessHash(token);
  return !order.user_id && !!actual && !!order.guest_access_hash && actual === order.guest_access_hash;
}
function signature(orderId: string, expires: string) {
  const secret = process.env.TICKET_QR_SIGNING_SECRET;
  if (!secret) throw new Error("TICKET_QR_SIGNING_SECRET is not set");
  return createHmac("sha256", secret).update(`guest-ticket-download:${orderId}:${expires}`).digest("base64url");
}
export function guestDownloadToken(orderId: string) {
  const expires = String(Math.floor(Date.now()/1000) + 365*24*60*60);
  return `${expires}.${signature(orderId, expires)}`;
}
export function validGuestDownloadToken(orderId: string, token: string | null) {
  if (!token || !/^\d{10}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [expires, supplied] = token.split(".");
  if (Number(expires) <= Date.now()/1000) return false;
  const expected = signature(orderId, expires);
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
