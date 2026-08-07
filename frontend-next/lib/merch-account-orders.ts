export type MerchAccountOrderItem = {
  title: string;
  variant: string;
  quantity: number;
  imageUrl: string | null;
  lineTotalMinor: number;
};

export type MerchAccountOrder = {
  orderNumber: string;
  createdAt: string | null;
  status: "processing" | "shipped" | "delivered" | "refunded" | "cancelled";
  currency: string;
  totalMinor: number;
  items: MerchAccountOrderItem[];
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeMinor(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

function safeImageUrl(value: unknown) {
  const candidate = cleanString(value).slice(0, 2000);
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeMerchAccountOrders(payload: unknown): MerchAccountOrder[] {
  const orders = record(payload).orders;
  if (!Array.isArray(orders)) return [];
  const allowedStatuses = new Set<MerchAccountOrder["status"]>([
    "processing", "shipped", "delivered", "refunded", "cancelled"
  ]);
  return orders.flatMap((value) => {
    const order = record(value);
    const orderNumber = cleanString(order.orderNumber).slice(0, 100);
    if (!orderNumber) return [];
    const rawStatus = cleanString(order.status).toLowerCase() as MerchAccountOrder["status"];
    const status = allowedStatuses.has(rawStatus) ? rawStatus : "processing";
    const rawItems = Array.isArray(order.items) ? order.items : [];
    const items = rawItems.map((itemValue): MerchAccountOrderItem => {
      const item = record(itemValue);
      return {
        title: cleanString(item.title).slice(0, 240) || "Merch item",
        variant: cleanString(item.variant).slice(0, 180),
        quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
        imageUrl: safeImageUrl(item.imageUrl),
        lineTotalMinor: safeMinor(item.lineTotalMinor)
      };
    });
    const createdAt = cleanString(order.createdAt);
    return [{
      orderNumber,
      createdAt: createdAt && Number.isFinite(Date.parse(createdAt)) ? createdAt : null,
      status,
      currency: cleanString(order.currency).toLowerCase() || "gbp",
      totalMinor: safeMinor(order.totalMinor),
      items
    }];
  });
}
