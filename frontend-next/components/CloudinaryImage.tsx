import type { CSSProperties } from "react";
import {
  cloudinaryUrl,
  type CloudinaryAsset
} from "../lib/cloudinary";

type CloudinaryImageProps = {
  asset: CloudinaryAsset;
  alt: string;
  className?: string;
  sizes: string;
  maxWidth?: number;
  priority?: boolean;
  style?: CSSProperties;
};

const RESPONSIVE_WIDTHS = [240, 320, 480, 560, 640, 768, 960, 1200, 1476];

export default function CloudinaryImage({
  asset,
  alt,
  className,
  sizes,
  maxWidth = asset.width,
  priority = false,
  style
}: CloudinaryImageProps) {
  const cappedWidth = Math.min(maxWidth, asset.width);
  const widths = Array.from(
    new Set([
      ...RESPONSIVE_WIDTHS.filter((width) => width < cappedWidth),
      cappedWidth
    ])
  );
  const src = cloudinaryUrl(asset, { width: cappedWidth });
  const srcSet = widths
    .map(
      (width) =>
        `${cloudinaryUrl(asset, { width })} ${Math.min(width, asset.width)}w`
    )
    .join(", ");

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={asset.width}
      height={asset.height}
      alt={alt}
      className={className}
      style={style}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
