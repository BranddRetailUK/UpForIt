import type { Metadata } from "next";
import AuthForm from "../../../components/AuthForm";
import { safeNextPath } from "../../../lib/public-url";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  const nextPath = safeNextPath(query.next);
  return (
    <div className="inner-page section-wrap account-page">
      <section className="account-panel account-panel--centered-heading">
        <p className="comic-kicker comic-kicker--yellow">Join the party</p>
        <h1>Create account</h1>
        <p>Set up your account before buying tickets.</p>
        <AuthForm mode="signup" nextPath={nextPath} />
      </section>
    </div>
  );
}
