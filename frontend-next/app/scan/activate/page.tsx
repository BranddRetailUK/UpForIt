import type { Metadata } from "next";
import ScannerActivation from "../../../components/ScannerActivation";

export const metadata: Metadata = { title: "Activate ticket scanner", robots: { index: false, follow: false } };

export default async function ScannerActivationPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const query = await searchParams;
  const relink = query.mode === "relink";
  return (
    <div className="inner-page section-wrap account-page scanner-activation-page">
      <section className="account-panel">
        <p className="comic-kicker comic-kicker--yellow">Door team</p>
        <h1>{relink ? "Relink scanner" : "Activate scanner"}</h1>
        <p>{relink
          ? "Restoring access for this enrolled device. Its existing name and scan history will be kept."
          : "Enter an optional label, then this device will stay authorised until two hours after the event finishes."}</p>
        <ScannerActivation mode={relink ? "relink" : "enrol"} />
      </section>
    </div>
  );
}
