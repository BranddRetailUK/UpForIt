export type MerchProductTitle = {
  mainTitle: string;
  subtitle: string;
};

export function splitMerchProductTitle(title: string): MerchProductTitle {
  const normalizedTitle = String(title || "").trim();
  const titleParts = normalizedTitle
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    mainTitle: titleParts[0] || normalizedTitle,
    subtitle: titleParts.length > 1 ? titleParts.slice(1).join(" ") : ""
  };
}
