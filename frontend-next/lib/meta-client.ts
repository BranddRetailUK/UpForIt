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
  try { return entry ? decodeURIComponent(entry.slice(prefix.length)) : ""; }
  catch { return ""; }
}

// Keep the landing click in memory until consent; never persist it beforehand.
let landingClick: { id: string; time: number } | undefined;
const CLICK_ID = /^[A-Za-z0-9_-]{1,500}$/;
export function rememberMetaClick() {
  if (typeof window === "undefined") return;
  const consent = readMetaConsent();
  if (consent === "denied") { landingClick = undefined; return; }
  const id = new URL(window.location.href).searchParams.get("fbclid");
  if (id && CLICK_ID.test(id) && id !== landingClick?.id) landingClick = { id, time: Date.now() };
  if (consent !== "granted" || !landingClick) return;
  const existing = readCookie("_fbc");
  if (/^fb\.\d+\.\d{8,}\.[A-Za-z0-9_-]+$/.test(existing) && existing.split(".").slice(3).join(".") === landingClick.id) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `_fbc=fb.1.${landingClick.time}.${landingClick.id}; Path=/; Max-Age=7776000; SameSite=Lax${secure}`;
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
  landingClick = undefined;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  for (const name of ["_fbp", "_fbc"]) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    // Pixel cookies may be scoped to the parent domain rather than this host.
    const hostname = window.location.hostname;
    if (hostname === "upforitevents.co.uk" || hostname.endsWith(".upforitevents.co.uk")) {
      for (const domain of new Set([hostname, "upforitevents.co.uk"])) {
        document.cookie = `${name}=; Path=/; Domain=${domain}; Max-Age=0; SameSite=Lax${secure}`;
      }
    }
  }
}

export function createMetaEventId(prefix: string) {
  const normalized = prefix.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 36) || "event";
  return `${normalized}_${window.crypto.randomUUID()}`;
}

export function getMetaBrowserContext(eventId: string): MetaBrowserContext {
  const context: MetaBrowserContext = { eventId };
  if (readMetaConsent() !== "granted") return context;
  rememberMetaClick();
  const fbp = readCookie("_fbp");
  const fbc = readCookie("_fbc");
  if (fbp) context.fbp = fbp;
  if (fbc) context.fbc = fbc;
  return context;
}
