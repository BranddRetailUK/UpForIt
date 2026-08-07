import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminCheckIn from "../../../components/AdminCheckIn";
import { getCurrentUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ticket check-in", robots: { index: false, follow: false } };

export default async function CheckInPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  if (user.role !== "admin") redirect(user.role === "staff" ? "/scan" : "/account");
  return (
    <div className="admin-shell section-wrap">
      <header className="admin-header"><div><p className="comic-kicker comic-kicker--yellow">Door team</p><h1>Ticket check-in</h1></div><Link href="/admin">Back to admin</Link></header>
      <section className="admin-panel"><AdminCheckIn /></section>
    </div>
  );
}
