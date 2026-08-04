import { ImageResponse } from "next/og";
import { CLOUDINARY_ASSETS, cloudinaryUrl } from "../lib/cloudinary";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  const smiley = cloudinaryUrl(CLOUDINARY_ASSETS.smiley, {
    width: 385,
    format: "png"
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent"
        }}
      >
        <img
          src={smiley}
          alt=""
          width="385"
          height="492"
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    size
  );
}
