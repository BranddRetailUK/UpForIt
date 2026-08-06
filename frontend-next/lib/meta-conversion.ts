import { createHash } from "node:crypto";

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

function graphVersion() {
  const configured = String(process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION).trim();
  return /^v\d+\.\d+$/.test(configured) ? configured : DEFAULT_GRAPH_VERSION;
}

export function hashMetaValue(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
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
