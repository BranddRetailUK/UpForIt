import type { Metadata } from "next";
import AuthForm from "../../../components/AuthForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; error?: string }> }) {
  const query = await searchParams;
  return (
    <div className="inner-page section-wrap account-page">
      <section className="account-panel">
        <p className="comic-kicker comic-kicker--yellow">Welcome back</p>
        <h1>Sign in</h1>
        {query.reset ? <p className="form-message form-message--success">Password updated. You can sign in now.</p> : null}
        {query.error ? <p className="form-message form-message--error">That verification link is invalid or expired.</p> : null}
        <AuthForm mode="login" />
      </section>
    </div>
  );
}
