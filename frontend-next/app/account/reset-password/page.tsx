import type { Metadata } from "next";
import AuthForm from "../../../components/AuthForm";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="inner-page section-wrap account-page">
      <section className="account-panel">
        <h1>Choose a new password</h1>
        {token ? <AuthForm mode="reset" token={token} /> : <p className="form-message form-message--error">This reset link is incomplete.</p>}
      </section>
    </div>
  );
}
