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
  title: "UP FOR IT",
  description: "Exclusive event. Limited tickets.",
  openGraph: {
    title: "UP FOR IT",
    description: "Exclusive event. Limited tickets.",
    type: "website",
    images: [
      {
        url: "https://cdn.shopify.com/s/files/1/0841/7545/4535/files/FLYER_NEW.jpg?v=1769687281",
        width: 1200,
        height: 2130,
        alt: "UP FOR IT event flyer"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "UP FOR IT",
    description: "Exclusive event. Limited tickets.",
    images: [
      "https://cdn.shopify.com/s/files/1/0841/7545/4535/files/FLYER_NEW.jpg?v=1769687281"
    ]
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
