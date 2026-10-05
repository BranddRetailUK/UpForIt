import { SOCIAL_SHARE_IMAGE } from "../lib/social-metadata";
import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { CartProvider } from "../components/CartProvider";
import { MetaTrackingProvider } from "../components/MetaTrackingProvider";
import { isMetaMerchTrackingEnabled } from "../lib/meta-shared";
import "./globals.css";
import "./industrial.css";

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
    default: "UPFORIT | Events, Music & Clothing",
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
    title: "UPFORIT | Events, Music & Clothing",
    description:
      "UPFORIT events, music, mixes and clothing.",
    type: "website",
    url: "/",
    siteName: "UPFORIT",
    locale: "en_GB",
    images: [SOCIAL_SHARE_IMAGE]
  },
  twitter: {
    card: "summary_large_image",
    title: "UPFORIT | Events, Music & Clothing",
    description: "UPFORIT events, music, mixes and clothing.",
    images: [SOCIAL_SHARE_IMAGE.url]
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
