const RESPONSIVE_WIDTHS = [160, 240, 320, 480, 640, 768, 960];

export function optimizedMerchImageUrl(src: string, width: number) {
  const marker = "/image/upload/";
  try {
    const url = new URL(src);
    if (!url.hostname.endsWith("res.cloudinary.com") || !url.pathname.includes(marker)) return src;
    url.pathname = url.pathname.replace(
      marker,
      `${marker}f_auto,q_auto,c_limit,w_${Math.max(1, Math.round(width))}/`
    );
    return url.toString();
  } catch {
    return src;
  }
}

export default function MerchImage({
  src,
  alt,
  className,
  sizes,
  priority = false
}: {
  src: string;
  alt: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const optimizedSrc = optimizedMerchImageUrl(src, 960);
  const isCloudinary = optimizedSrc !== src;
  const srcSet = isCloudinary
    ? RESPONSIVE_WIDTHS.map((width) => `${optimizedMerchImageUrl(src, width)} ${width}w`).join(", ")
    : undefined;

  return (
    <img
      src={optimizedSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
