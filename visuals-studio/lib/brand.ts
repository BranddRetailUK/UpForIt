import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { BRAND_CACHE_ROOT } from "./constants";
import type { BrandAssetId } from "./contracts";

export const BRAND_PALETTE = {
  ink: "#050505",
  paper: "#ffffff",
  blue: "#008ef0",
  blueLight: "#29c6f5",
  blueDeep: "#0065d9",
  yellow: "#ffdf00",
  pink: "#d90062"
} as const;

export const BRAND_ASSETS = {
  roundLogo: {
    publicId: "NEW_ROUND_LOGO_amtvr0",
    format: "png",
    width: 1202,
    height: 1174
  },
  navLogo: {
    publicId: "WHITE_LOGO_WEB_filqtw",
    format: "png",
    width: 1234,
    height: 359
  },
  smiley: {
    publicId: "SOLID_SMILEY_taznwv",
    format: "png",
    width: 861,
    height: 1101
  }
} as const;

export function brandAssetUrl(assetId: BrandAssetId) {
  const asset = BRAND_ASSETS[assetId];
  return `https://res.cloudinary.com/brandduk/image/upload/${asset.publicId}.${asset.format}`;
}

export function brandAssetPath(assetId: BrandAssetId) {
  const asset = BRAND_ASSETS[assetId];
  return path.join(/* turbopackIgnore: true */ BRAND_CACHE_ROOT, `${assetId}.${asset.format}`);
}

export async function getBrandStatus() {
  const assets = await Promise.all(
    (Object.keys(BRAND_ASSETS) as BrandAssetId[]).map(async (id) => {
      try {
        const info = await stat(/* turbopackIgnore: true */ brandAssetPath(id));
        return { id, ready: info.size > 0, size: info.size, path: brandAssetPath(id) };
      } catch {
        return { id, ready: false, size: 0, path: brandAssetPath(id) };
      }
    })
  );
  return { ready: assets.every((asset) => asset.ready), assets };
}

export async function syncBrandAssets() {
  await mkdir(BRAND_CACHE_ROOT, { recursive: true });
  const results = [];
  for (const id of Object.keys(BRAND_ASSETS) as BrandAssetId[]) {
    const response = await fetch(brandAssetUrl(id), { redirect: "follow" });
    if (!response.ok) throw new Error(`Unable to download ${id} (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100) throw new Error(`Downloaded asset ${id} is unexpectedly small.`);
    const outputPath = brandAssetPath(id);
    await writeFile(outputPath, bytes);
    results.push({
      id,
      path: outputPath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex")
    });
  }
  await writeFile(
    path.join(BRAND_CACHE_ROOT, "manifest.json"),
    JSON.stringify({ syncedAt: new Date().toISOString(), palette: BRAND_PALETTE, assets: results }, null, 2)
  );
  return results;
}

export async function hashFile(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}
