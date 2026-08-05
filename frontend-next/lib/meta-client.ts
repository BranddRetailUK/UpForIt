import {
  META_CONSENT_COOKIE,
  META_CONSENT_DENIED,
  META_CONSENT_GRANTED,
  type MetaBrowserContext,
  type MetaConsent
} from "./meta-shared";

export function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
}

export function readMetaConsent(): MetaConsent {
  const value = readCookie(META_CONSENT_COOKIE);
  if (value === META_CONSENT_GRANTED || value === META_CONSENT_DENIED) return value;
  return "unknown";
}

export function persistMetaConsent(consent: Exclude<MetaConsent, "unknown">) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${META_CONSENT_COOKIE}=${consent}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`;
}

export function deleteMetaAttributionCookies() {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  for (const name of ["_fbp", "_fbc"]) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }
}

export function createMetaEventId(prefix: string) {
  const normalized = prefix.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 36) || "event";
  return `${normalized}_${window.crypto.randomUUID()}`;
}

export function getMetaBrowserContext(eventId: string): MetaBrowserContext {
  const context: MetaBrowserContext = { eventId };
  const fbp = readCookie("_fbp");
  const fbc = readCookie("_fbc");
  if (fbp) context.fbp = fbp;
  if (fbc) context.fbc = fbc;
  return context;
}
