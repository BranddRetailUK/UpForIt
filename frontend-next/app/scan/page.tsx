import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import AdminCheckIn from "../../components/AdminCheckIn";
import ScannerEndAccessButton from "../../components/ScannerEndAccessButton";
import { getCurrentUser } from "../../lib/auth";
import { SCANNER_SESSION_COOKIE } from "../../lib/scanner-access";
import { getScannerSessionForToken } from "../../lib/scanner-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket scanner", robots: { index: false, follow: false } };

export default async function ScannerPage() {
  const user = await getCurrentUser();
  const accountAccess = user?.role === "admin" ? user : null;
  const cookieStore = await cookies();
  const scannerSession = accountAccess ? null : await getScannerSessionForToken(
    cookieStore.get(SCANNER_SESSION_COOKIE)?.value,
    true
  );

  if (!accountAccess && !scannerSession) {
    return (
      <div className="inner-page section-wrap account-page scanner-ended-page">
        <section className="account-panel">
          <p className="comic-kicker comic-kicker--pink">Scanner locked</p>
          <h1>Access needed</h1>
          <p>Ask Scott to display the scanner enrolment QR, then scan it with this device.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-shell section-wrap scanner-page">
      <header className="admin-header">
        <div>
          <p className="comic-kicker comic-kicker--yellow">Door team</p>
          <h1>Ticket scanner</h1>
          <p>{scannerSession ? `${scannerSession.device_label} · ${scannerSession.event_title}` : `Signed in as ${accountAccess?.email}`}</p>
        </div>
        <nav>{accountAccess?.role === "admin" ? <Link href="/admin">Back to admin</Link> : scannerSession ? <ScannerEndAccessButton /> : <Link href="/account">My account</Link>}</nav>
      </header>
      <section className="admin-panel"><AdminCheckIn /></section>
    </div>
  );
}
