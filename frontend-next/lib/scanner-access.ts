export const SCANNER_SESSION_COOKIE = "upforit_scanner";
export const SCANNER_ENROLMENT_MINUTES = 10;
export const SCANNER_EVENT_GRACE_HOURS = 2;
export const SCANNER_MAX_DEVICES = 20;

export function scannerSessionExpiry(eventEndsAt: Date) {
  return new Date(eventEndsAt.getTime() + SCANNER_EVENT_GRACE_HOURS * 60 * 60 * 1000);
}

export function scannerActivationUrl(siteUrl: string, enrolmentToken: string, relink = false) {
  const activationUrl = new URL("/scan/activate", siteUrl);
  if (relink) activationUrl.searchParams.set("mode", "relink");
  activationUrl.hash = new URLSearchParams({ token: enrolmentToken }).toString();
  return activationUrl;
}

export function scannerCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    expires
  };
}

export function scannerDeviceLabel(value: unknown, fallbackNumber: number) {
  if (typeof value !== "string") return `Door device ${fallbackNumber}`;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 60);
  return normalized || `Door device ${fallbackNumber}`;
}
