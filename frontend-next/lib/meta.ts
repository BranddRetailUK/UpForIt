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

type MetaUserData = {
  email?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  clientUserAgent?: string;
};

export type MetaContent = {
  id: string;
  quantity: number;
  itemPriceMinor?: number;
};

export type MetaConversionInput = {
  eventName: "Lead" | "InitiateCheckout" | "Purchase";
  eventId: string;
  eventSourceUrl: string;
  eventTime?: number;
  valueMinor?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  contents?: MetaContent[];
  userData?: MetaUserData;
};

export type MetaSendResult = {
  sent: boolean;
  reason?: "not_configured" | "invalid_event" | "request_failed";
  status?: number;
};

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
  purchaseRoas: number;
  leads: number;
};

export type MetaAdsSummaryResult =
  | MetaAdsSummary
  | { state: "not_configured" }
  | { state: "error"; status?: number };

function graphVersion() {
  const configured = String(process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION).trim();
  return /^v\d+\.\d+$/.test(configured) ? configured : DEFAULT_GRAPH_VERSION;
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

export function hashMetaValue(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
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

export function buildMetaEvent(input: MetaConversionInput) {
  if (!EVENT_ID_PATTERN.test(input.eventId)) throw new Error("Invalid Meta event ID");
  const userData: Record<string, string | string[]> = {};
  if (input.userData?.email) userData.em = [hashMetaValue(input.userData.email)];
  if (input.userData?.externalId) userData.external_id = [hashMetaValue(input.userData.externalId)];
  if (input.userData?.fbp && FBP_PATTERN.test(input.userData.fbp)) userData.fbp = input.userData.fbp;
  if (input.userData?.fbc && FBC_PATTERN.test(input.userData.fbc)) userData.fbc = input.userData.fbc;
  if (input.userData?.clientIp && input.userData.clientIp !== "unknown") userData.client_ip_address = input.userData.clientIp;
  if (input.userData?.clientUserAgent) userData.client_user_agent = input.userData.clientUserAgent;

  const contents = (input.contents || [])
    .filter((content) => content.id && Number.isFinite(content.quantity) && content.quantity > 0)
    .map((content) => ({
      id: String(content.id),
      quantity: Math.trunc(content.quantity),
      ...(Number.isFinite(content.itemPriceMinor) ? { item_price: Number(content.itemPriceMinor) / 100 } : {})
    }));
  const customData: Record<string, unknown> = {};
  if (Number.isFinite(input.valueMinor)) customData.value = Number(input.valueMinor) / 100;
  if (input.currency) customData.currency = input.currency.toUpperCase();
  if (input.contentName) customData.content_name = input.contentName;
  if (input.contentCategory) customData.content_category = input.contentCategory;
  if (contents.length) {
    customData.contents = contents;
    customData.content_ids = contents.map((content) => content.id);
    customData.content_type = "product";
    customData.num_items = contents.reduce((sum, content) => sum + content.quantity, 0);
  }

  return {
    event_name: input.eventName,
    event_time: input.eventTime || Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    event_source_url: input.eventSourceUrl.split("?")[0],
    user_data: userData,
    ...(Object.keys(customData).length ? { custom_data: customData } : {})
  };
}

export async function sendMetaConversion(input: MetaConversionInput): Promise<MetaSendResult> {
  const pixelId = String(process.env.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
  const accessToken = String(process.env.META_CONVERSIONS_API_ACCESS_TOKEN || "").trim();
  if (!/^\d+$/.test(pixelId) || !accessToken) return { sent: false, reason: "not_configured" };

  let event;
  try {
    event = buildMetaEvent(input);
  } catch {
    return { sent: false, reason: "invalid_event" };
  }

  const testEventCode = String(process.env.META_TEST_EVENT_CODE || "").trim();
  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${pixelId}/events`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        data: [event],
        ...(testEventCode ? { test_event_code: testEventCode } : {})
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(META_REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      console.error(`[meta-capi] ${input.eventName} request failed with status ${response.status}`);
      return { sent: false, reason: "request_failed", status: response.status };
    }
    return { sent: true, status: response.status };
  } catch (error) {
    console.error(`[meta-capi] ${input.eventName} request failed`, error instanceof Error ? error.name : "UnknownError");
    return { sent: false, reason: "request_failed" };
  }
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

export function parseMetaAdsSummary(payload: unknown): MetaAdsSummary | null {
  const data = payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)
    ? (payload as { data: Array<Record<string, unknown>> }).data[0]
    : undefined;
  if (!data) return null;
  const purchaseTypes = ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"];
  const leadTypes = ["offsite_conversion.fb_pixel_lead", "lead", "onsite_conversion.lead_grouped"];
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
    purchaseValue: actionValue(data.action_values, purchaseTypes),
    purchaseRoas: actionValue(data.purchase_roas, purchaseTypes),
    leads: actionValue(data.actions, leadTypes)
  };
}

export async function getMetaAdsSummary(): Promise<MetaAdsSummaryResult> {
  const accountId = String(process.env.META_AD_ACCOUNT_ID || "").trim();
  const accessToken = String(process.env.META_MARKETING_API_ACCESS_TOKEN || "").trim();
  const appSecret = String(process.env.META_APP_SECRET || "").trim();
  if (!/^act_\d+$/.test(accountId) || !accessToken) return { state: "not_configured" };

  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${accountId}/insights`);
  url.searchParams.set("date_preset", "last_30d");
  url.searchParams.set("level", "account");
  url.searchParams.set("fields", "spend,impressions,reach,clicks,inline_link_clicks,ctr,cpc,actions,action_values,purchase_roas,date_start,date_stop");
  if (appSecret) url.searchParams.set("appsecret_proof", createHmac("sha256", appSecret).update(accessToken).digest("hex"));

  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(META_REQUEST_TIMEOUT_MS)
    });
    if (!response.ok) {
      console.error(`[meta-insights] request failed with status ${response.status}`);
      return { state: "error", status: response.status };
    }
    return parseMetaAdsSummary(await response.json()) || {
      state: "ready",
      dateStart: "",
      dateStop: "",
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      linkClicks: 0,
      ctr: 0,
      cpc: 0,
      purchases: 0,
      purchaseValue: 0,
      purchaseRoas: 0,
      leads: 0
    };
  } catch (error) {
    console.error("[meta-insights] request failed", error instanceof Error ? error.name : "UnknownError");
    return { state: "error" };
  }
}
