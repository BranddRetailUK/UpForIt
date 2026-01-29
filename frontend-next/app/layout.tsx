import type { Metadata } from "next";
import { Oswald, Rubik_Glitch, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Rubik_Glitch({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display"
});

const body = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body"
});

const condensed = Oswald({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-condensed"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.upforitevents.co.uk"),
  title: "UPFORIT | Underground Bass Music",
  description:
    "A heavyweight UK bass event built around drum & bass culture showcasing local and established artists from the 3 counties area and beyond",
  alternates: {
    canonical: "https://www.upforitevents.co.uk"
  },
  openGraph: {
    title: "UPFORIT | Underground Bass Music",
    description:
      "A heavyweight UK bass event built around drum & bass culture showcasing local and established artists from the 3 counties area and beyond",
    type: "website",
    url: "https://www.upforitevents.co.uk",
    siteName: "UPFORIT",
    locale: "en_GB",
    images: [
      {
        url: "https://www.upforitevents.co.uk/opengraph-image.jpg",
        width: 1500,
        height: 2051,
        alt: "UPFORIT Open Graph image"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "UPFORIT | Underground Bass Music",
    description:
      "A heavyweight UK bass event built around drum & bass culture showcasing local and established artists from the 3 counties area and beyond",
    images: ["https://www.upforitevents.co.uk/opengraph-image.jpg"]
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
      className={`${display.variable} ${body.variable} ${condensed.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
