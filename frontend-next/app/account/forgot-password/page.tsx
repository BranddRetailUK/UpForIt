import type { Metadata } from "next";
import AuthForm from "../../../components/AuthForm";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="inner-page section-wrap account-page">
      <section className="account-panel">
        <h1>Reset password</h1>
        <p>Enter your account email and we’ll send a reset link.</p>
        <AuthForm mode="forgot" />
      </section>
    </div>
  );
}

