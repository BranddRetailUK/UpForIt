const INTERNAL_PATH_BASE = "https://internal.upforit.invalid";

export function publicUrl(path: string, fallbackOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return new URL(path, configuredOrigin || fallbackOrigin);
}

export function safeNextPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) return undefined;

  try {
    const candidate = new URL(value, INTERNAL_PATH_BASE);
    if (candidate.origin !== INTERNAL_PATH_BASE) return undefined;
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return undefined;
  }
}

export function verificationUrl(siteUrl: string, token: string, nextPath?: unknown) {
  const url = new URL("/api/auth/verify", siteUrl);
  url.searchParams.set("token", token);
  const destination = safeNextPath(nextPath);
  if (destination) url.searchParams.set("next", destination);
  return url;
}
