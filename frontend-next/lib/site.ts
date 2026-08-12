export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/music", label: "Music & Mixes" },
  { href: "/merch", label: "Merch" },
  { href: "/socials", label: "Socials" },
  { href: "/contact", label: "Contact" },
  { href: "/account", label: "Account" }
] as const;

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter(
  (item) => item.href !== "/contact"
);

export const SOCIAL_LINKS = [
  {
    name: "TikTok",
    handle: "@upforit.events",
    href: "https://www.tiktok.com/@upforit.events",
    shortLabel: "TT"
  },
  {
    name: "Facebook",
    handle: "@up4ituk",
    href: "https://www.facebook.com/up4ituk",
    shortLabel: "f"
  },
  {
    name: "Instagram",
    handle: "@up_for_it_events_uk",
    href: "https://www.instagram.com/up_for_it_events_uk",
    shortLabel: "IG"
  }
] as const;
