import type { Metadata } from "next";
import ScannerActivation from "../../../components/ScannerActivation";

export const metadata: Metadata = { title: "Activate ticket scanner", robots: { index: false, follow: false } };

export default function ScannerActivationPage() {
  return (
    <div className="inner-page section-wrap account-page scanner-activation-page">
      <section className="account-panel">
        <p className="comic-kicker comic-kicker--yellow">Door team</p>
        <h1>Activate scanner</h1>
        <p>Enter an optional label, then this device will stay authorised until two hours after the event finishes.</p>
        <ScannerActivation />
      </section>
    </div>
  );
}
