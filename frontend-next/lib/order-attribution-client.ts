import { ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE, captureAttribution, readOrderAttribution } from './order-attribution';
import { readCookie, readMetaConsent } from './meta-client';
let capturedThisDocument = false;
export function clearOrderAttribution() {
  document.cookie = `${ATTRIBUTION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  capturedThisDocument = false;
}
export function rememberOrderAttribution() {
  if (readMetaConsent() !== 'granted') { clearOrderAttribution(); return; }
  if (capturedThisDocument) return;
  try {
    const previous = readOrderAttribution(encodeURIComponent(readCookie(ATTRIBUTION_COOKIE)), true);
    const value = captureAttribution(location.href, document.referrer, previous);
    if (!value) return;
    capturedThisDocument = true;
    document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${ATTRIBUTION_MAX_AGE}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch { /* Attribution must never prevent checkout or page rendering. */ }
}
