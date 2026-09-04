import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UPFORIT Visuals Studio",
  description: "Local-only After Effects generator for UPFORIT event screens.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
