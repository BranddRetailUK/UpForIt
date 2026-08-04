import { ImageResponse } from "next/og";
import { CLOUDINARY_ASSETS, cloudinaryUrl } from "../lib/cloudinary";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  const logo = cloudinaryUrl(CLOUDINARY_ASSETS.roundLogo, {
    width: 460,
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
          border: "18px solid #050505",
          borderRadius: 96,
          background: "#008ef0"
        }}
      >
        <img
          src={logo}
          alt=""
          width="438"
          height="428"
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    size
  );
}

