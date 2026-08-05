import type { Metadata } from "next";
import TicketConfirmation from "../../../components/TicketConfirmation";

export const metadata: Metadata = { title: "Ticket confirmation", robots: { index: false } };

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  return (
    <div className="inner-page section-wrap account-page">
      <section className="account-panel">
        <p className="comic-kicker comic-kicker--yellow">Nice one!</p>
        <h1>Ticket confirmation</h1>
        {sessionId ? <TicketConfirmation sessionId={sessionId} /> : <p>That confirmation link is incomplete.</p>}
      </section>
    </div>
  );
}
