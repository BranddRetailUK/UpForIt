"use client";

import { useMetaTracking } from "./MetaTrackingProvider";

export default function CookieSettingsButton() {
  const { openSettings } = useMetaTracking();
  return <button className="site-footer__legal-button" type="button" onClick={openSettings}>Cookie settings</button>;
}
