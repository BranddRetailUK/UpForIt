import { redirect } from "next/navigation";
import { getPool } from "../../lib/db";
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
  const scannerOrigin = process.env.ADMIN_SCANNER_ORIGIN || (process.env.APP_ENV === "production" ? "https://admin-production-7548.up.railway.app" : null);
  if (scannerOrigin) redirect(new URL("/scan", scannerOrigin).toString());
  const isTesting = process.env.APP_ENV === "testing";
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

          <h1>Access needed</h1>
          <p>Ask Scott to display the scanner enrolment QR, then scan it with this device.</p>
        </section>
      </div>
    );
  }

  const events = accountAccess ? (await getPool().query<{id:string;title:string}>("SELECT id,title FROM events WHERE status <> 'cancelled' AND now() < ends_at + interval '2 hours' ORDER BY starts_at")).rows : [];
  return (
    <div className="admin-shell section-wrap scanner-page">
      <header className="admin-header">
        <div>

          <h1>{isTesting ? "Testing scanner" : "Ticket scanner"}</h1>
          <p>{isTesting ? "Use test tickets only. These tickets are not valid for entry at the event." : "Use live event tickets. Test email tickets must be scanned in the separate Testing scanner."}</p>
          <p>{scannerSession ? `${scannerSession.device_label} · ${scannerSession.event_title}` : `Signed in as ${accountAccess?.email}`}</p>
        </div>
        <nav>{accountAccess?.role === "admin" ? <Link href="/admin">Back to admin</Link> : scannerSession ? <ScannerEndAccessButton /> : <Link href="/account">My account</Link>}</nav>
      </header>
      <section className="admin-panel"><AdminCheckIn events={events} fixedEventId={scannerSession?.event_id} /></section>
    </div>
  );
}
