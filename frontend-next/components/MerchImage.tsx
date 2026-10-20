const RESPONSIVE_WIDTHS = [160, 240, 320, 480, 640, 768, 960];

export function optimizedMerchImageUrl(src: string, width: number) {
  const marker = "/image/upload/";
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.includes(marker)) return src;
    // Signed/token URLs cannot be changed without invalidating their signature.
    if (url.search || url.pathname.includes("/s--")) return src;
    const [prefix, delivery] = url.pathname.split(marker);
    const segments = delivery.split("/");
    const transformations: string[] = [];
    // Stop at the version/public ID. Preserve upstream crops, overlays and effects
    // in their original order; only constrain the finished result.
    const parameter = /^(?:a|ac|af|ar|b|bo|c|co|cs|d|dl|dn|dpr|du|e|eo|f|fl|fn|fps|g|h|if|ki|l|o|p|pg|q|r|so|sp|t|u|vc|vs|w|x|y|z)_/;
    while (segments.length > 1 && segments[0].split(",").every((part) => parameter.test(part))) {
      transformations.push(segments.shift()!);
    }
    // Replace only our own terminal delivery step on subsequent calls.
    if (/^f_auto,q_auto,c_limit,w_\d+$/.test(transformations[transformations.length - 1] || "")) transformations.pop();
    const safeWidth = Number.isFinite(width) ? Math.min(960, Math.max(1, Math.round(width))) : 960;
    transformations.push(`f_auto,q_auto,c_limit,w_${safeWidth}`);
    url.pathname = `${prefix}${marker}${[...transformations, ...segments].join("/")}`;
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
  const isCloudinary = optimizedMerchImageUrl(src, 160) !== optimizedSrc;
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
