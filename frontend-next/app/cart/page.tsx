import type { Metadata } from "next";
import CartPageClient from "../../components/CartPageClient";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your UPFORIT merch and continue to secure checkout.",
  robots: { index: false, follow: false }
};

export default async function CartPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  return (
    <div className="inner-page section-wrap cart-page">
      <header className="page-intro">
        <p className="comic-kicker comic-kicker--pink">Nearly yours</p>
        <h1>Your cart</h1>
      </header>
      <CartPageClient cancelled={checkout === "cancelled"} />
    </div>
  );
}
