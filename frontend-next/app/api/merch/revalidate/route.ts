import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { merchSecret } from "../../../../lib/merch";

export const runtime = "nodejs";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const body = await request.text();
  const timestamp = String(request.headers.get("x-storefront-timestamp") || "");
  const signature = String(request.headers.get("x-storefront-signature") || "");
  const parsedTimestamp = Number.parseInt(timestamp, 10);
  const secret = merchSecret();
  const path = new URL(request.url).pathname;
  if (!secret || !Number.isFinite(parsedTimestamp) || Math.abs(Date.now() / 1000 - parsedTimestamp) > 300) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const expected = createHmac("sha256", secret)
    .update([timestamp, "POST", path, body].join("."))
    .digest("hex");
  if (!safeEqual(expected, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let productId = "";
  try { productId = String(JSON.parse(body)?.productId || ""); } catch {}
  revalidateTag("upforit-merch");
  revalidatePath("/merch", "layout");
  if (productId) revalidateTag(`upforit-product:${productId}`);
  return NextResponse.json({ revalidated: true });
}
