"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMetaTracking } from "./MetaTrackingProvider";
import { trackingPath } from "../lib/site-analytics";
let lastPath = "", lastAt = 0;
export default function PageAnalyticsTracker() {
  const pathname = usePathname();
  const { consent } = useMetaTracking();
  useEffect(() => {
    if (consent !== "granted") { lastPath = ""; return; }
    const path = trackingPath(pathname);
    if (!path || (lastPath === path && Date.now() - lastAt < 500)) return;
    lastPath = path; lastAt = Date.now();
    void fetch("/api/analytics/hit", {
      method: "POST", credentials: "same-origin", keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: crypto.randomUUID(), path })
    }).catch(() => undefined);
  }, [pathname, consent]);
  return null;
}
