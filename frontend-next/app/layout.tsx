import type { Metadata } from "next";
import { Archivo_Black, Bangers, Space_Grotesk } from "next/font/google";
import PopArtScene from "../components/PopArtScene";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import "./globals.css";

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
    "UPFORIT brings big sounds, good people and no bad energy together on the dancefloor.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "UPFORIT | Events, Music & Good Vibes",
    description:
      "Big sounds, good people and no bad energy. Discover what is next from UPFORIT.",
    type: "website",
    url: "/",
    siteName: "UPFORIT",
    locale: "en_GB",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "UPFORIT"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "UPFORIT | Events, Music & Good Vibes",
    description: "Good vibes only. Respect the ravers. No bad energy.",
    images: ["/opengraph-image"]
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
        <div className="site-shell">
          <PopArtScene />
          <SiteHeader />
          <main className="site-main">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
