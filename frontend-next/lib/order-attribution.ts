/** Browser-reported source evidence, not proof that an advert caused a purchase. */
export const ATTRIBUTION_COOKIE = 'upforit_order_source';
export const ATTRIBUTION_MAX_AGE = 30 * 86400;
export type OrderAttribution = {
  version: 1; source: string; medium: string; campaign?: string; content?: string;
  campaignId?: string; adsetId?: string; placement?: string;
  referrerHost?: string; landingPath: string; capturedAt: string;
};
const token = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_.-]{1,120}$/.test(v) ? v : undefined;
const host = (v: unknown) => typeof v === 'string' && v.length <= 253 && /^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/.test(v) ? v : undefined;
const publicPath = (v: unknown) => typeof v === 'string' && /^(?:\/|\/(?:events|music|merch|socials|contact|privacy)(?:\/[a-z0-9-]{1,80}){0,2})$/.test(v) ? v : null;
export function normalizeAttribution(value: unknown, now = Date.now()): OrderAttribution | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>, source = token(r.source), medium = token(r.medium), landingPath = publicPath(r.landingPath);
  const captured = typeof r.capturedAt === 'string' ? Date.parse(r.capturedAt) : NaN;
  if (r.version !== 1 || !source || !medium || !landingPath || !Number.isFinite(captured) || captured > now + 60000 || now - captured > ATTRIBUTION_MAX_AGE * 1000) return null;
  return { version: 1, source, medium, landingPath, capturedAt: new Date(captured).toISOString(),
    campaign: token(r.campaign), content: token(r.content), campaignId: token(r.campaignId),
    adsetId: token(r.adsetId), placement: token(r.placement), referrerHost: host(r.referrerHost) };
}
export function readOrderAttribution(raw: string | undefined, consent: boolean, now = Date.now()) {
  if (!consent || !raw || raw.length > 3000) return null;
  try { return normalizeAttribution(JSON.parse(decodeURIComponent(raw)), now); } catch { return null; }
}
export function captureAttribution(href: string, referrer: string, previous: OrderAttribution | null, now = Date.now()): OrderAttribution | null {
  const url = new URL(href), landingPath = publicPath(url.pathname);
  if (!landingPath) return previous;
  const sameSite = (h: string) => h.replace(/^www\./, '') === url.hostname.replace(/^www\./, '');
  let referrerHost: string | undefined;
  try { const r = new URL(referrer); if (/^https?:$/.test(r.protocol) && !sameSite(r.hostname) && !/(^|\.)(stripe\.com|stripe\.network)$/.test(r.hostname)) referrerHost = host(r.hostname); } catch {}
  const p = url.searchParams, taggedSource = token(p.get('utm_source'));
  // Direct/internal visits and checkout returns preserve the previous source.
  if (!taggedSource && !referrerHost && previous) return previous;
  const source = taggedSource || (referrerHost ? /(^|\.)(facebook\.com|fb\.com)$/.test(referrerHost) ? 'facebook' : /(^|\.)instagram\.com$/.test(referrerHost) ? 'instagram' : /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(referrerHost) ? 'search' : referrerHost : 'direct');
  return normalizeAttribution({version:1, source, medium:token(p.get('utm_medium')) || (referrerHost ? 'referral' : 'unknown'),
    campaign:token(p.get('utm_campaign')),content:token(p.get('utm_content')),campaignId:token(p.get('utm_id')),
    adsetId:token(p.get('utm_adset')),placement:token(p.get('utm_placement')),referrerHost,landingPath,capturedAt:new Date(now).toISOString()},now);
}
