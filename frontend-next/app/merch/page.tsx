import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Merch",
  description: "UPFORIT merch is coming soon.",
  alternates: { canonical: "/merch" }
};

export default function MerchPage() {
  return (
    <div className="inner-page section-wrap">
      <header className="page-intro">
        <p className="comic-kicker comic-kicker--pink">Fresh gear incoming</p>
        <h1>Merch</h1>
      </header>

      <section className="placeholder-card" aria-labelledby="merch-status">
        <div className="placeholder-card__splat" aria-hidden="true">!</div>
        <p className="placeholder-card__small">Watch this space</p>
        <h2 id="merch-status">Merch dropping soon</h2>
        <p>
          We&apos;re getting the first UPFORIT pieces ready. Products, sizing and
          ordering will appear here when the drop is live.
        </p>
        <Link className="pop-button pop-button--pink" href="/socials">
          Follow the drop
        </Link>
      </section>
    </div>
  );
}

