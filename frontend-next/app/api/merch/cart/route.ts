import { NextResponse } from "next/server";
import { getMerchCatalogue } from "../../../../lib/merch";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
    return NextResponse.json({
      lines,
      removedCount: removedVariantIds.length,
      removedVariantIds
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to refresh cart" }, { status: 400 });
  }
}
