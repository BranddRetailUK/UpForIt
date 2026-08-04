import { ImageResponse } from "next/og";
import { CLOUDINARY_ASSETS, cloudinaryUrl } from "../lib/cloudinary";

export const runtime = "edge";
export const alt = "UPFORIT — good vibes only";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const logo = cloudinaryUrl(CLOUDINARY_ASSETS.navLogo, {
    width: 1000,
    format: "png"
  });

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: "#008ef0",
          backgroundImage:
            "linear-gradient(135deg, #29c6f5 0%, #008ef0 55%, #0065d9 100%)"
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 980,
            height: 980,
            borderRadius: 490,
            border: "110px solid rgba(41,198,245,.72)"
          }}
        />
        <div
          style={{
            position: "relative",
            width: 900,
            padding: "70px 72px 55px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            border: "10px solid #050505",
            borderRadius: 58,
            background: "#050505",
            boxShadow: "18px 18px 0 #ffdf00"
          }}
        >
          <img
            src={logo}
            alt=""
            width="750"
            height="219"
            style={{ objectFit: "contain" }}
          />
          <div
            style={{
              marginTop: 28,
              padding: "13px 28px",
              display: "flex",
              border: "5px solid #ffffff",
              background: "#f30b70",
              color: "#ffffff",
              fontSize: 35,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: "uppercase"
            }}
          >
            Good vibes only
          </div>
        </div>
      </div>
    ),
    size
  );
}
