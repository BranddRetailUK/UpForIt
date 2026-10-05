import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { CartProvider } from "../components/CartProvider";
import { MetaTrackingProvider } from "../components/MetaTrackingProvider";
import { isMetaMerchTrackingEnabled } from "../lib/meta-shared";
import "./globals.css";
import "./industrial.css";

const SOCIAL_SHARE_IMAGE =
  "https://res.cloudinary.com/brandduk/image/upload/v1791200584/UPFORIT/industrial-2026/industrial-banner.png";
const FAVICON_IMAGE =
  "https://res.cloudinary.com/brandduk/image/upload/v1786281482/LOGO_FAV_smiley_c4wm5v.png";

const heavy = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heavy",
  display: "swap"
});

const body = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.upforitevents.co.uk"),
  title: {
    default: "UPFORIT | Events, Music & Good Vibes",
    template: "UPFORIT | %s"
  },
  description:
    "UPFORIT events, music, mixes and clothing.",
  icons: {
    icon: [{ url: FAVICON_IMAGE, type: "image/png" }],
    shortcut: [{ url: FAVICON_IMAGE, type: "image/png" }],
    apple: [{ url: FAVICON_IMAGE, type: "image/png" }]
  },
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "UPFORIT | Events, Music & Good Vibes",
    description:
      "UPFORIT events, music, mixes and clothing.",
    type: "website",
    url: "/",
    siteName: "UPFORIT",
    locale: "en_GB",
    images: [
      {
        url: SOCIAL_SHARE_IMAGE,
        width: 2172,
        height: 724,
        alt: "UPFORIT Events"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "UPFORIT | Events, Music & Good Vibes",
    description: "UPFORIT events, music, mixes and clothing.",
    images: [SOCIAL_SHARE_IMAGE]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${heavy.variable} ${body.variable}`}
    >
      <body>
        <MetaTrackingProvider
          pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID || ""}
          merchTrackingEnabled={isMetaMerchTrackingEnabled(process.env.META_MERCH_TRACKING_ENABLED)}
        >
          <CartProvider>
            <div className="site-shell">

              <SiteHeader />
              <a className="skip-link" href="#main-content">Skip to content</a>
              <main id="main-content" className="site-main">{children}</main>
              <SiteFooter />
            </div>
          </CartProvider>
        </MetaTrackingProvider>
      </body>
    </html>
  );
}
