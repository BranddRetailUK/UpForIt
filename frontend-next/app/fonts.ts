import localFont from "next/font/local";
import { Oswald, Rubik_Glitch, Space_Grotesk } from "next/font/google";

export const flyer = localFont({
  src: [
    {
      path: "../public/fonts/doctor-glitch.otf",
      weight: "400",
      style: "normal"
    }
  ],
  variable: "--font-flyer",
  display: "swap",
  fallback: ["Impact", "Arial Black", "sans-serif"]
});

export const display = Rubik_Glitch({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  fallback: ["Impact", "Arial Black", "sans-serif"]
});

export const body = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  fallback: ["Segoe UI", "sans-serif"]
});

export const condensed = Oswald({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-condensed",
  display: "swap",
  fallback: ["Arial Narrow", "sans-serif"]
});
