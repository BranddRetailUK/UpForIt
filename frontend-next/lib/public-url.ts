export function publicUrl(path: string, fallbackOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return new URL(path, configuredOrigin || fallbackOrigin);
}
