import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../../lib/auth";
import {
  calculateTicketMerchDiscountMinor,
  getUsableMerchDiscount,
  reconcileMerchDiscountFromConfirmation
} from "../../../../lib/merch-discounts";
import { getMerchCatalogue } from "../../../../lib/merch";
import { getMerchCheckoutConfirmation } from "../../../../lib/merch";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const input = await request.json();
    const requested = Array.isArray(input?.items) ? input.items : [];
    const products = await getMerchCatalogue({ noStore: true });
    const variants = new Map<string, { product: (typeof products)[number]; variant: (typeof products)[number]["variants"][number] }>();
    products.forEach((product) => product.variants.forEach((variant) => variants.set(String(variant.id), { product, variant })));
    const removedVariantIds: string[] = [];
    const lines = requested.flatMap((item: { variantId?: unknown; quantity?: unknown }) => {
      const requestedVariantId = String(item?.variantId || "");
      const match = variants.get(String(item?.variantId || ""));
      if (!match || !match.variant.available) {
        if (requestedVariantId) removedVariantIds.push(requestedVariantId);
        return [];
      }
      const image = match.product.images.find((entry) => String(entry.id) === String(match.variant.imageId)) || match.product.images[0];
      return [{
        productId: match.product.id,
        productKind: match.product.productKind || "",
        variantId: match.variant.id,
        slug: match.product.slug,
        title: match.product.title,
        variantLabel: [match.variant.option1, match.variant.option2, match.variant.option3].filter(Boolean).join(" / "),
        imageUrl: image?.src || "",
        priceMinor: match.variant.priceMinor,
        currency: match.product.currency,
        quantity: Math.min(20, Math.max(1, Math.trunc(Number(item.quantity || 1))))
      }];
    });
    const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    let entitlement = user ? await getUsableMerchDiscount(user.id) : null;
    if (entitlement?.status === "reserved" && entitlement.stripeCheckoutSessionId) {
      try {
        const { response, payload } = await getMerchCheckoutConfirmation(entitlement.stripeCheckoutSessionId);
        if (response.ok) {
          await reconcileMerchDiscountFromConfirmation({
            entitlementId: String(payload.discountEntitlementId || entitlement.id),
            checkoutSessionId: entitlement.stripeCheckoutSessionId,
            paid: payload.paid === true,
            status: String(payload.status || "")
          });
          entitlement = user ? await getUsableMerchDiscount(user.id) : null;
        }
      } catch {
        // Keep the local reservation visible while Good Game is temporarily unavailable.
      }
    }
    const subtotalMinor = lines.reduce(
      (sum: number, line: { priceMinor: number; quantity: number }) => sum + line.priceMinor * line.quantity,
      0
    );
    const discountMinor = entitlement ? calculateTicketMerchDiscountMinor(subtotalMinor) : 0;
    return NextResponse.json({
      lines,
      removedCount: removedVariantIds.length,
      removedVariantIds,
      discount: entitlement ? {
        entitlementId: entitlement.id,
        percentOff: entitlement.percentOff,
        amountMinor: discountMinor,
        discountedSubtotalMinor: Math.max(0, subtotalMinor - discountMinor),
        status: entitlement.status
      } : null
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to refresh cart" }, { status: 400 });
  }
}
