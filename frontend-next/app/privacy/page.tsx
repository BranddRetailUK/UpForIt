import type { Metadata } from "next";
import { isMetaMerchTrackingEnabled } from "../../lib/meta-shared";

export const metadata: Metadata = {
  title: "Privacy and advertising measurement",
  description: "How UPFORIT uses cookies and Meta advertising measurement tools.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  const merchTrackingEnabled = isMetaMerchTrackingEnabled(process.env.META_MERCH_TRACKING_ENABLED);

  return (
    <div className="inner-page section-wrap">
      <article className="privacy-panel">

        <h1>Privacy and ad measurement</h1>
        <p>
          UPFORIT uses essential storage needed for features such as the merch cart. We only activate
          Meta advertising measurement after you choose Accept in our cookie notice.
        </p>

        <h2>Website analytics</h2>
        <p>After you accept optional cookies, we record page paths and times directly in our database,
          using a random visitor cookie lasting up to one year and a session cookie renewed for 1 minute
          after each page hit. This helps us count page hits, visitors and visits. We do not store query
          strings, IP addresses or account-page paths in these analytics records. Declining stops this tracking.</p>
        <h2>What Meta measurement records</h2>
        {merchTrackingEnabled ? (
          <p>
            With consent, the Meta Pixel records page views, newsletter sign-ups, ticket activity and merchandise
            activity such as viewing products, adding items to the cart, beginning checkout and completed purchases.
            Our server can send matching conversion events through Meta&apos;s Conversions API so advertising results
            remain measurable when a browser event is unavailable.
          </p>
        ) : (
          <p>
            With consent, the Meta Pixel records page views, newsletter sign-ups and ticket activity such as viewing
            ticket availability, beginning ticket checkout and completed ticket purchases. Our server can send matching
            conversion events through Meta&apos;s Conversions API so advertising results remain measurable when a browser
            event is unavailable. Merchandise sales activity is not currently sent to Meta.
          </p>
        )}

        <h2>Information used</h2>
        <p>
          With consent, a completed Blackley&apos;s Bucket entry is recorded as a registration,
          separately from a ticket purchase. The browser and server share an event identifier
          so the same entry is not counted twice. Entry names, phone numbers and draw results
          are not sent to Meta.
        </p>
        <p>
          Measurement data can include the page path, event time, {merchTrackingEnabled ? "product or ticket" : "ticket"} identifiers,
          quantities, order value and currency, browser information, IP address and Meta&apos;s first-party <code>_fbp</code>
          and <code>_fbc</code> identifiers. For consented sign-ups, ticket activity and bucket entries,
          email addresses and account identifiers are SHA-256 hashed on our server before being sent to Meta.
          We do not send payment-card details, passwords
          or Stripe checkout-session references to Meta.
        </p>

        <h2>Your choice</h2>
        <p>
          Declining prevents the Meta script from loading and prevents consent-gated server events. Your choice
          is remembered for 180 days. Use Cookie settings in the footer at any time to change it. Withdrawing
          consent does not affect access to the website or checkout.
        </p>

        <h2>More information</h2>
        <p>
          Meta processes measurement data under its own terms and privacy policy. For questions about UPFORIT&apos;s
          use of this data, contact us through the official profiles on our Contact page.
        </p>
      </article>
    </div>
  );
}
