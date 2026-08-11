import "server-only";

import { createHash, createHmac } from "node:crypto";
import {
  META_CONSENT_COOKIE,
  META_CONSENT_GRANTED,
  type MetaBrowserContext
} from "./meta-shared";

const DEFAULT_GRAPH_VERSION = "v25.0";
const META_REQUEST_TIMEOUT_MS = 3500;
const EVENT_ID_PATTERN = /^[A-Za-z0-9:_-]{1,100}$/;
const FBP_PATTERN = /^fb\.1\.\d{8,}\.\d+$/;
const FBC_PATTERN = /^fb\.1\.\d{8,}\.[A-Za-z0-9_-]+$/;
export {
  buildMetaEvent,
  hashMetaValue,
  sendMetaConversion,
  type MetaContent,
  type MetaConversionInput,
  type MetaSendResult
} from "./meta-conversion";

export type MetaAdsSummary = {
  state: "ready";
  dateStart: string;
  dateStop: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  purchases: number;
  purchaseValue: number;
};

export type MetaAdsCampaignSummary = MetaAdsSummary & {
  campaignId: string;
  campaignName: string;
};

export type MetaAdsAnalyticsResult =
  | { state: "ready"; all: MetaAdsSummary; campaigns: MetaAdsCampaignSummary[] }
  | { state: "not_configured" }
  | { state: "error"; status?: number };

type MetaCampaign = { id: string; name: string };

function graphVersion() {
  const configured = String(process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION).trim();
  return /^v\d+\.\d+$/.test(configured) ? configured : DEFAULT_GRAPH_VERSION;
}

export function metaAdsTimeRange(now = new Date()) {
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(dateParts.find((entry) => entry.type === type)?.value);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const since = new Date(Date.UTC(year, month - 1, day));
  since.setUTCDate(since.getUTCDate() - 29);

  return {
    since: since.toISOString().slice(0, 10),
    until: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  };
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : "";
}

export function requestHasMetaConsent(request: Request) {
  return cookieValue(request.headers.get("cookie"), META_CONSENT_COOKIE) === META_CONSENT_GRANTED;
}

function normalizedBrowserValue(value: unknown, pattern: RegExp) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return pattern.test(normalized) ? normalized : undefined;
}

export function getMetaRequestContext(request: Request, input: unknown) {
  const value = input && typeof input === "object" ? input as Partial<MetaBrowserContext> : {};
  const eventId = normalizedBrowserValue(value.eventId, EVENT_ID_PATTERN);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const directIp = request.headers.get("x-real-ip")?.trim();
  return {
    consent: requestHasMetaConsent(request),
    eventId,
    fbp: normalizedBrowserValue(value.fbp, FBP_PATTERN) || normalizedBrowserValue(cookieValue(request.headers.get("cookie"), "_fbp"), FBP_PATTERN),
    fbc: normalizedBrowserValue(value.fbc, FBC_PATTERN) || normalizedBrowserValue(cookieValue(request.headers.get("cookie"), "_fbc"), FBC_PATTERN),
    clientIp: forwarded || directIp || undefined,
    clientUserAgent: request.headers.get("user-agent")?.slice(0, 500) || undefined
  };
}

export function metaEventId(prefix: string, stableValue: string) {
  const normalizedPrefix = prefix.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 32) || "event";
  const digest = createHash("sha256").update(stableValue).digest("hex").slice(0, 32);
  return `${normalizedPrefix}_${digest}`;
}

export function metaSiteUrl(pathname: string) {
  const origin = String(process.env.NEXT_PUBLIC_SITE_URL || "https://www.upforitevents.co.uk").trim().replace(/\/+$/, "");
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${safePath.split("?")[0]}`;
}

function numeric(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function actionValue(actions: unknown, priorities: string[]) {
  if (!Array.isArray(actions)) return 0;
  for (const actionType of priorities) {
    const match = actions.find((action) => action && typeof action === "object" && (action as { action_type?: string }).action_type === actionType) as { value?: unknown } | undefined;
    if (match) return numeric(match.value);
  }
  return 0;
}

function emptyMetaAdsSummary(dateStart = "", dateStop = ""): MetaAdsSummary {
  return {
    state: "ready",
    dateStart,
    dateStop,
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    linkClicks: 0,
    ctr: 0,
    cpc: 0,
    purchases: 0,
    purchaseValue: 0
  };
}

function parseMetaAdsRow(data: Record<string, unknown>): MetaAdsSummary {
  const purchaseTypes = ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"];
  return {
    state: "ready",
    dateStart: String(data.date_start || ""),
    dateStop: String(data.date_stop || ""),
    spend: numeric(data.spend),
    impressions: numeric(data.impressions),
    reach: numeric(data.reach),
    clicks: numeric(data.clicks),
    linkClicks: numeric(data.inline_link_clicks),
    ctr: numeric(data.ctr),
    cpc: numeric(data.cpc),
    purchases: actionValue(data.actions, purchaseTypes),
    purchaseValue: actionValue(data.action_values, purchaseTypes)
  };
}

function payloadRows(payload: unknown) {
  return payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)
    ? (payload as { data: Array<Record<string, unknown>> }).data
    : [];
}

export function parseMetaAdsSummary(payload: unknown): MetaAdsSummary | null {
  const data = payloadRows(payload)[0];
  return data ? parseMetaAdsRow(data) : null;
}

export function parseMetaCampaignAdsSummaries(
  payload: unknown,
  campaigns: MetaCampaign[],
  fallbackRange: { since: string; until: string }
) {
  const rowsByCampaignId = new Map(
    payloadRows(payload).map((row) => [String(row.campaign_id || ""), row])
  );
  return campaigns.map((campaign): MetaAdsCampaignSummary => {
    const row = rowsByCampaignId.get(campaign.id);
    return {
      ...(row ? parseMetaAdsRow(row) : emptyMetaAdsSummary(fallbackRange.since, fallbackRange.until)),
      campaignId: campaign.id,
      campaignName: campaign.name
    };
  });
}

function metaUrl(path: string, parameters: Record<string, string>, accessToken: string, appSecret: string) {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${path}`);
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
  if (appSecret) {
    url.searchParams.set("appsecret_proof", createHmac("sha256", appSecret).update(accessToken).digest("hex"));
  }
  return url;
}

async function fetchMeta(url: URL, accessToken: string) {
  return fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(META_REQUEST_TIMEOUT_MS)
  });
}

export async function getMetaAdsAnalytics(): Promise<MetaAdsAnalyticsResult> {
  const accountId = String(process.env.META_AD_ACCOUNT_ID || "").trim();
  const accessToken = String(process.env.META_MARKETING_API_ACCESS_TOKEN || "").trim();
  const appSecret = String(process.env.META_APP_SECRET || "").trim();
  if (!/^act_\d+$/.test(accountId) || !accessToken) return { state: "not_configured" };

  const timeRange = metaAdsTimeRange();
  const metricFields = "spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,actions,action_values,date_start,date_stop";
  const activeCampaignsUrl = metaUrl(`${accountId}/campaigns`, {
    fields: "id,name,effective_status",
    filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]),
    limit: "100"
  }, accessToken, appSecret);

  try {
    const campaignResponse = await fetchMeta(activeCampaignsUrl, accessToken);
    if (!campaignResponse.ok) {
      console.error(`[meta-campaigns] request failed with status ${campaignResponse.status}`);
      return { state: "error", status: campaignResponse.status };
    }
    const campaigns = payloadRows(await campaignResponse.json())
      .map((campaign) => ({ id: String(campaign.id || ""), name: String(campaign.name || "Unnamed campaign") }))
      .filter((campaign) => campaign.id);
    if (!campaigns.length) {
      return {
        state: "ready",
        all: emptyMetaAdsSummary(timeRange.since, timeRange.until),
        campaigns: []
      };
    }

    const activeCampaignFilter = JSON.stringify([{
      field: "campaign.id",
      operator: "IN",
      value: campaigns.map((campaign) => campaign.id)
    }]);
    const accountInsightsUrl = metaUrl(`${accountId}/insights`, {
      time_range: JSON.stringify(timeRange),
      level: "account",
      filtering: activeCampaignFilter,
      fields: metricFields
    }, accessToken, appSecret);
    const campaignInsightsUrl = metaUrl(`${accountId}/insights`, {
      time_range: JSON.stringify(timeRange),
      level: "campaign",
      filtering: activeCampaignFilter,
      fields: `campaign_id,campaign_name,${metricFields}`,
      limit: "100"
    }, accessToken, appSecret);
    const [accountResponse, campaignInsightsResponse] = await Promise.all([
      fetchMeta(accountInsightsUrl, accessToken),
      fetchMeta(campaignInsightsUrl, accessToken)
    ]);
    if (!accountResponse.ok || !campaignInsightsResponse.ok) {
      const status = !accountResponse.ok ? accountResponse.status : campaignInsightsResponse.status;
      console.error(`[meta-insights] request failed with status ${status}`);
      return { state: "error", status };
    }
    const [accountPayload, campaignPayload] = await Promise.all([
      accountResponse.json(),
      campaignInsightsResponse.json()
    ]);
    return {
      state: "ready",
      all: parseMetaAdsSummary(accountPayload) || emptyMetaAdsSummary(timeRange.since, timeRange.until),
      campaigns: parseMetaCampaignAdsSummaries(campaignPayload, campaigns, timeRange)
    };
  } catch (error) {
    console.error("[meta-insights] request failed", error instanceof Error ? error.name : "UnknownError");
    return { state: "error" };
  }
}
