import assets from "./brand-assets.json";
import type { CloudinaryAsset } from "./cloudinary";

export type PastEvent = {
  slug: string; title: string; date: string; dateLabel: string; hours: string;
  venue: string; genres: string; artists: string; mcs: string; soundSystem?: string;
  flyer: CloudinaryAsset;
};
export const PAST_EVENTS: PastEvent[] = [
  {
    slug: "summer-roundup-2026", title: "The Summer Round Up", date: "2026-09-26",
    dateLabel: "26 September 2026", hours: "Noon–11PM", venue: "McCarthys Sports Bar, Bletchley",
    genres: "UKG · Drum & Bass · Electro · Breaks · Dance · Hardcore",
    artists: "Road 23 / Spektral / Scott Charles / Haribo / Ectomorph / Sinik / Tommo / Savage / Slumberjack / Deechase / Bandy / Jack Panic",
    mcs: "E Dappa / Danzee / Razor / Treble", soundSystem: "Revolt Sound System",
    flyer: { ...assets["summer-2026-flyer"], format: "jpg" }
  },
  {
    slug: "day-festival-june-2026", title: "Multi Genre Day Festival", date: "2026-06-27",
    dateLabel: "27 June 2026", hours: "Midday–10PM", venue: "McCarthys Sports Bar, Bletchley",
    genres: "UKG · Drum & Bass · Electro · UK Bass · Prog · Hardcore · Garage",
    artists: "Spektral / Diatribe Showcase / Scott Charles / Sinik B2B Savage / Slumber Jack / Deechase B2B Lady Elusive / Luke Teknology B2B Spin Larden / Ectomorph / Vessel",
    mcs: "E Dappa / Danzee / Razor / Ashman / Treble / Hypeman",
    flyer: { ...assets["june-2026-flyer"], format: "png" }
  }
];
