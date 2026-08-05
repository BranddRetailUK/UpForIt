import type { Metadata } from "next";
import { Archivo_Black, Bangers, Space_Grotesk } from "next/font/google";
import PopArtScene from "../components/PopArtScene";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { CartProvider } from "../components/CartProvider";
import { MetaTrackingProvider } from "../components/MetaTrackingProvider";
import "./globals.css";

const SOCIAL_SHARE_IMAGE =
  "https://res.cloudinary.com/brandduk/image/upload/v1785833927/UPFORIT_Summer_Round_Up_PP_hjq2nh.png";

const display = Bangers({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

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
    template: "%s | UPFORIT"
  },
  description:
    "Discover upcoming UPFORIT events, event news and future merch.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "UPFORIT | Events, Music & Good Vibes",
    description:
      "Discover upcoming UPFORIT events, event news and future merch.",
    type: "website",
    url: "/",
    siteName: "UPFORIT",
    locale: "en_GB",
    images: [
      {
        url: SOCIAL_SHARE_IMAGE,
        width: 1254,
        height: 1254,
        alt: "UPFORIT Summer Roundup"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "UPFORIT | Events, Music & Good Vibes",
    description: "Discover upcoming UPFORIT events, event news and future merch.",
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
      className={`${display.variable} ${heavy.variable} ${body.variable}`}
    >
      <body>
        <MetaTrackingProvider pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID || ""}>
          <CartProvider>
            <div className="site-shell">
              <PopArtScene />
              <SiteHeader />
              <main className="site-main">{children}</main>
              <SiteFooter />
            </div>
          </CartProvider>
        </MetaTrackingProvider>
      </body>
    </html>
  );
}
