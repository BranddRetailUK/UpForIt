import assets from "./brand-assets.json";

// Explicit JPEG and dimensions give sharing crawlers a compact, predictable image.
export const SOCIAL_SHARE_IMAGE = {
  url: assets["social-share-clean"].url.replace("/image/upload/", "/image/upload/c_fill,w_1200,h_630,f_jpg,q_85/"),
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "UPFORIT — Events, Music & Clothing"
};
