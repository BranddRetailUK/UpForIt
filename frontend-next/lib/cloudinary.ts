export type CloudinaryAsset = {
  publicId: string;
  format: "png" | "jpg";
  width: number;
  height: number;
};

export type CloudinaryUrlOptions = {
  width: number;
  format?: "auto" | "png" | "jpg";
  quality?: "auto" | number;
};

export type CloudinaryAudioFormat = "mp3" | "m4a" | "ogg";
export type CloudinaryVideoFormat = "mp4" | "webm";

export type CloudinaryArtworkUrlOptions = {
  width: number;
  height: number;
};

const CLOUD_NAME = "brandduk";
const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;
const CLOUDINARY_MEDIA_BASE_URL = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload`;

export const CLOUDINARY_ASSETS = {
  navLogo: {
    publicId: "WHITE_LOGO_WEB_filqtw",
    format: "png",
    width: 1234,
    height: 359
  },
  roundLogo: {
    publicId: "NEW_ROUND_LOGO_amtvr0",
    format: "png",
    width: 1202,
    height: 1174
  },
  smiley: {
    publicId: "SOLID_SMILEY_taznwv",
    format: "png",
    width: 861,
    height: 1101
  },
  summerRoundup: {
    publicId: "SUMMER_ROUND_UP_e2jcsl",
    format: "png",
    width: 1476,
    height: 812
  },
  summerRoundupBackground: {
    publicId: "UPFORIT/summer-roundup-2026-background",
    format: "jpg",
    width: 2480,
    height: 3508
  },
  summerRoundupPresents: {
    publicId: "UPFORIT/summer-roundup-2026-presents",
    format: "png",
    width: 840,
    height: 164
  },
  summerRoundupTitle: {
    publicId: "UPFORIT/summer-roundup-2026-title",
    format: "png",
    width: 1865,
    height: 1026
  },
  summerRoundupLineup: {
    publicId: "UPFORIT/summer-roundup-2026-lineup",
    format: "png",
    width: 2247,
    height: 1044
  },
  summerRoundupMcs: {
    publicId: "UPFORIT/summer-roundup-2026-mcs",
    format: "png",
    width: 2325,
    height: 336
  },
  summerRoundupRevolt: {
    publicId: "UPFORIT/summer-roundup-2026-revolt",
    format: "png",
    width: 987,
    height: 259
  },
  summerRoundupCloud: {
    publicId: "UPFORIT/summer-roundup-2026-cloud",
    format: "png",
    width: 329,
    height: 236
  },
  summerRoundupLightning: {
    publicId: "UPFORIT/summer-roundup-2026-lightning",
    format: "png",
    width: 250,
    height: 305
  }
} satisfies Record<string, CloudinaryAsset>;

export function cloudinaryUrl(
  asset: CloudinaryAsset,
  { width, format = "auto", quality = "auto" }: CloudinaryUrlOptions
) {
  const safeWidth = Math.min(Math.max(Math.round(width), 1), asset.width);
  const transforms = [
    `f_${format}`,
    `q_${quality}`,
    "c_limit",
    `w_${safeWidth}`
  ].join(",");

  return `${CLOUDINARY_BASE_URL}/${transforms}/${asset.publicId}.${asset.format}`;
}

function encodedPublicId(publicId: string) {
  return publicId
    .trim()
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function cloudinaryArtworkUrl(
  publicId: string,
  { width, height }: CloudinaryArtworkUrlOptions
) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const transforms = [
    "f_auto",
    "q_auto",
    "c_fill",
    "g_auto",
    `w_${safeWidth}`,
    `h_${safeHeight}`
  ].join(",");

  return `${CLOUDINARY_BASE_URL}/${transforms}/${encodedPublicId(publicId)}`;
}

export function cloudinaryAudioUrl(
  publicId: string,
  format: CloudinaryAudioFormat = "mp3"
) {
  return `${CLOUDINARY_MEDIA_BASE_URL}/f_${format},q_auto/${encodedPublicId(publicId)}.${format}`;
}

export function cloudinaryVideoUrl(
  publicId: string,
  format: CloudinaryVideoFormat = "mp4"
) {
  return `${CLOUDINARY_MEDIA_BASE_URL}/${encodedPublicId(publicId)}.${format}`;
}

export function cloudinaryVideoPosterUrl(
  publicId: string,
  { width, height }: CloudinaryArtworkUrlOptions
) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const transforms = [
    "f_jpg",
    "q_auto",
    "so_0",
    "c_fill",
    "g_auto",
    `w_${safeWidth}`,
    `h_${safeHeight}`
  ].join(",");

  return `${CLOUDINARY_MEDIA_BASE_URL}/${transforms}/${encodedPublicId(publicId)}.jpg`;
}

export function safeCloudinaryDownloadName(filename: string) {
  const safeName = filename
    .trim()
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return safeName || "upforit-mix";
}

export function cloudinaryAudioDownloadUrl(
  publicId: string,
  filename: string,
  format: CloudinaryAudioFormat = "mp3"
) {
  const safeName = safeCloudinaryDownloadName(filename);
  const transforms = [`fl_attachment:${safeName}`, `f_${format}`, "q_auto"].join(",");

  return `${CLOUDINARY_MEDIA_BASE_URL}/${transforms}/${encodedPublicId(publicId)}.${format}`;
}
