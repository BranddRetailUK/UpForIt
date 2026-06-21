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
  title: "UPFORIT Multi Genre Day Festival | 27 June 2026",
  description:
    "UPFORIT Multi Genre Day Festival at McCarthys Sports Bar, Bletchley on Saturday 27 June 2026, midday to 10PM.",
  alternates: {
    canonical: "https://www.upforitevents.co.uk"
  },
  openGraph: {
    title: "UPFORIT Multi Genre Day Festival | 27 June 2026",
    description:
      "UPFORIT Multi Genre Day Festival at McCarthys Sports Bar, Bletchley on Saturday 27 June 2026, midday to 10PM.",
    type: "website",
    url: "https://www.upforitevents.co.uk",
    siteName: "UPFORIT",
    locale: "en_GB",
    images: [
      {
        url: "https://www.upforitevents.co.uk/new-flyer/poster.png",
        width: 1054,
        height: 1492,
        alt: "UPFORIT Multi Genre Day Festival flyer"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "UPFORIT Multi Genre Day Festival | 27 June 2026",
    description:
      "UPFORIT Multi Genre Day Festival at McCarthys Sports Bar, Bletchley on Saturday 27 June 2026, midday to 10PM.",
    images: ["https://www.upforitevents.co.uk/new-flyer/poster.png"]
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
