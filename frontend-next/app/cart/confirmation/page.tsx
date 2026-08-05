import type { Metadata } from "next";
import CheckoutConfirmation from "../../../components/CheckoutConfirmation";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false }
};

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const query = await searchParams;
  const sessionId = String(query.session_id || "");
  return (
    <div className="inner-page section-wrap confirmation-page">
      {/^cs_[A-Za-z0-9_]+$/.test(sessionId) ? (
        <CheckoutConfirmation sessionId={sessionId} />
      ) : (
        <section className="confirmation-card"><h1>Order link unavailable</h1><p>This confirmation link is missing its Stripe session reference.</p></section>
      )}
    </div>
  );
}
