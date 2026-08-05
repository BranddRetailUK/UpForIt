"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Mode = "signup" | "login" | "forgot" | "reset";

export default function AuthForm({ mode, token, nextPath }: { mode: Mode; token?: string; nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");
    setBusy(true);
    const data = new FormData(form);
    const endpoints: Record<Mode, string> = {
      signup: "/api/auth/register",
      login: "/api/auth/login",
      forgot: "/api/auth/forgot-password",
      reset: "/api/auth/reset-password"
    };
    const payload: Record<string, string> = {};
    for (const [key, value] of data.entries()) payload[key] = String(value);
    if (token) payload.token = token;

    try {
      const response = await fetch(endpoints[mode], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Something went wrong.");

      if (mode === "login") {
        const destination = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/account";
        router.push(destination);
        router.refresh();
      } else if (mode === "reset") {
        router.push("/account/login?reset=1");
      } else if (mode === "signup") {
        setMessage("Account created. Check your email to verify it before signing in.");
        form.reset();
      } else {
        setMessage("If that email belongs to an account, a reset link is on its way.");
        form.reset();
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit}>
      {mode === "signup" ? (
        <label>
          Name
          <input name="displayName" autoComplete="name" minLength={2} maxLength={80} required />
        </label>
      ) : null}
      {mode !== "reset" ? (
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
      ) : null}
      {mode === "signup" || mode === "login" || mode === "reset" ? (
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "login" ? undefined : 12}
            required
          />
          {mode !== "login" ? <small>At least 12 characters.</small> : null}
        </label>
      ) : null}
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <button className="pop-button pop-button--yellow" disabled={busy} type="submit">
        {busy
          ? "Working…"
          : mode === "signup"
            ? "Create account"
            : mode === "login"
              ? "Sign in"
              : mode === "forgot"
                ? "Send reset link"
                : "Set new password"}
      </button>
      <div className="account-form__links">
        {mode === "login" ? <Link href="/account/forgot-password">Forgot password?</Link> : null}
        {mode !== "login" ? <Link href={nextPath ? `/account/login?next=${encodeURIComponent(nextPath)}` : "/account/login"}>Already have an account?</Link> : null}
        {mode === "login" ? <Link href={nextPath ? `/account/signup?next=${encodeURIComponent(nextPath)}` : "/account/signup"}>Create an account</Link> : null}
      </div>
    </form>
  );
}
