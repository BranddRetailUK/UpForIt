import type { Metadata } from "next";
import AuthForm from "../../../components/AuthForm";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignupPage() {
  return (
    <div className="inner-page section-wrap account-page">
      <section className="account-panel">
        <p className="comic-kicker comic-kicker--yellow">Join the party</p>
        <h1>Create account</h1>
        <p>Set up your account before buying tickets.</p>
        <AuthForm mode="signup" />
      </section>
    </div>
  );
}

