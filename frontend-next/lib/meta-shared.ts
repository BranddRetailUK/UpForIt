export const META_CONSENT_COOKIE = "upforit_meta_consent";
export const META_CONSENT_GRANTED = "granted";
export const META_CONSENT_DENIED = "denied";

export function isMetaMerchTrackingEnabled(value: unknown) {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

const META_CONSENT_INTERNAL_ROUTE_PREFIXES = ["/admin", "/account", "/scan", "/staff"];
const META_CONSENT_SENSITIVE_ROUTES = new Set(["/cart/confirmation", "/tickets/confirmation"]);

function matchesRoutePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isMetaConsentLandingPath(pathname: string) {
  if (!pathname.startsWith("/")) return false;
  if (META_CONSENT_SENSITIVE_ROUTES.has(pathname)) return false;
  return !META_CONSENT_INTERNAL_ROUTE_PREFIXES.some((prefix) => matchesRoutePrefix(pathname, prefix));
}

export type MetaConsent = "unknown" | typeof META_CONSENT_GRANTED | typeof META_CONSENT_DENIED;

export type MetaBrowserContext = {
  eventId: string;
  fbp?: string;
  fbc?: string;
};

export type MetaEventParameters = Record<string, string | number | boolean | string[] | Array<Record<string, string | number>> | undefined>;

export function shouldSendMetaBrowserEvent(
  parameters: MetaEventParameters,
  merchTrackingEnabled: boolean
) {
  return merchTrackingEnabled || parameters.content_category !== "merch";
}
