export const VISITOR_COOKIE = "upforit_analytics_visitor";
export const SESSION_COOKIE = "upforit_analytics_session";
export function validTrackingId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function trackingPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  const path = value.split(/[?#]/)[0].replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  if (path.length > 250 || /[\\\x00-\x20]/.test(path) || /^\/(api|admin|account|scan)(\/|$)/.test(path)) return null;
  return path;
}
