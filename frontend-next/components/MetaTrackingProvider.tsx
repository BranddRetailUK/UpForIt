"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  createMetaEventId,
  deleteMetaAttributionCookies,
  getMetaBrowserContext,
  persistMetaConsent,
  readMetaConsent
} from "../lib/meta-client";
import type { MetaBrowserContext, MetaConsent, MetaEventParameters } from "../lib/meta-shared";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

type MetaTrackingContextValue = {
  consent: MetaConsent;
  createEventId: (prefix: string) => string;
  getBrowserContext: (eventId: string) => MetaBrowserContext;
  openSettings: () => void;
  track: (eventName: string, parameters?: MetaEventParameters, eventId?: string) => string;
};

const MetaTrackingContext = createContext<MetaTrackingContextValue | null>(null);
const initializedPixelIds = new Set<string>();
let lastPageViewPath = "";

function installPixel(pixelId: string) {
  if (!pixelId || typeof window === "undefined") return;
  if (!window.fbq) {
    const fbq: Fbq = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
  }
  if (!document.querySelector('script[data-upforit-meta-pixel="true"]')) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.upforitMetaPixel = "true";
    document.head.appendChild(script);
  }
  window.fbq("consent", "grant");
  if (!initializedPixelIds.has(pixelId)) {
    window.fbq("init", pixelId);
    initializedPixelIds.add(pixelId);
  }
}

function containsSensitiveQuery(pathname: string) {
  if (typeof window === "undefined" || !window.location.search) return false;
  return pathname === "/cart/confirmation";
}

export function MetaTrackingProvider({
  children,
  pixelId
}: {
  children: React.ReactNode;
  pixelId: string;
}) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<MetaConsent>("unknown");
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setConsent(readMetaConsent());
    setReady(true);
  }, []);

  useEffect(() => {
    if (consent !== "granted" || !pixelId) return;
    installPixel(pixelId);
    if (containsSensitiveQuery(pathname)) return;
    const pagePath = pathname || window.location.pathname;
    if (lastPageViewPath === pagePath) return;
    window.fbq?.("track", "PageView");
    lastPageViewPath = pagePath;
  }, [consent, pathname, pixelId]);

  const chooseConsent = useCallback((next: Exclude<MetaConsent, "unknown">) => {
    persistMetaConsent(next);
    setConsent(next);
    setSettingsOpen(false);
    if (next === "denied") {
      window.fbq?.("consent", "revoke");
      deleteMetaAttributionCookies();
    }
  }, []);

  const track = useCallback((eventName: string, parameters: MetaEventParameters = {}, eventId?: string) => {
    const resolvedEventId = eventId || createMetaEventId(eventName);
    if (readMetaConsent() !== "granted" || !pixelId) return resolvedEventId;
    installPixel(pixelId);
    window.fbq?.("track", eventName, parameters, { eventID: resolvedEventId });
    return resolvedEventId;
  }, [pixelId]);

  const value = useMemo<MetaTrackingContextValue>(() => ({
    consent,
    createEventId: createMetaEventId,
    getBrowserContext: getMetaBrowserContext,
    openSettings: () => setSettingsOpen(true),
    track
  }), [consent, track]);

  const showBanner = ready && (consent === "unknown" || settingsOpen);

  return (
    <MetaTrackingContext.Provider value={value}>
      {children}
      {showBanner ? (
        <section className="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-banner-title">
          <div>
            <p className="comic-kicker comic-kicker--yellow">Your choice</p>
            <h2 id="cookie-banner-title">Help us measure what works?</h2>
            <p>
              With your permission, we use the Meta Pixel and Conversions API to measure visits,
              sign-ups and purchases from our ads. Declining does not affect checkout.
            </p>
            <Link href="/privacy">How tracking works</Link>
          </div>
          <div className="cookie-banner__actions">
            <button className="pop-button pop-button--yellow" type="button" onClick={() => chooseConsent("granted")}>Accept</button>
            <button className="pop-button cookie-banner__decline" type="button" onClick={() => chooseConsent("denied")}>Decline</button>
            {consent !== "unknown" ? (
              <button className="text-button" type="button" onClick={() => setSettingsOpen(false)}>Keep current choice</button>
            ) : null}
          </div>
        </section>
      ) : null}
    </MetaTrackingContext.Provider>
  );
}

export function useMetaTracking() {
  const value = useContext(MetaTrackingContext);
  if (!value) throw new Error("useMetaTracking must be used inside MetaTrackingProvider");
  return value;
}
