import { preload } from "react-dom";

// Match the CSS image-set exactly so the preload is reused at each screen density.
const texture = "https://res.cloudinary.com/brandduk/image/upload/f_auto,q_auto/v1791452861/UPFORIT/nye-2026/centre-paper-texture.png";
const standardTexture = texture.replace("f_auto,q_auto/", "f_auto,q_auto,c_limit,w_760/");

export default function NyeBannerPreload() {
  preload(texture, { as: "image", imageSrcSet: `${standardTexture} 1x, ${texture} 2x` });
  return null;
}
