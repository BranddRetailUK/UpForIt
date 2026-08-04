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

const CLOUD_NAME = "brandduk";
const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

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

