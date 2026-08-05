export const META_CONSENT_COOKIE = "upforit_meta_consent";
export const META_CONSENT_GRANTED = "granted";
export const META_CONSENT_DENIED = "denied";

export type MetaConsent = "unknown" | typeof META_CONSENT_GRANTED | typeof META_CONSENT_DENIED;

export type MetaBrowserContext = {
  eventId: string;
  fbp?: string;
  fbc?: string;
};

export type MetaEventParameters = Record<string, string | number | boolean | string[] | Array<Record<string, string | number>> | undefined>;
