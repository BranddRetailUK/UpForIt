"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { notifyCartAuthChanged } from "../lib/cart-storage";
import { safeNextPath } from "../lib/public-url";

type Mode = "signup" | "login" | "forgot" | "reset";
type VerificationState = "waiting" | "verified" | "expired";

export default function AuthForm({ mode, token, nextPath }: { mode: Mode; token?: string; nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [signupSessionToken, setSignupSessionToken] = useState("");
  const [verificationState, setVerificationState] = useState<VerificationState>("waiting");
  const successPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (registeredEmail) successPanelRef.current?.focus();
  }, [registeredEmail]);

  useEffect(() => {
    if (mode !== "signup" || !signupSessionToken) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function pollVerification() {
      try {
        const response = await fetch("/api/auth/verification-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: signupSessionToken })
        });
        const result = (await response.json()) as { verified?: boolean };
        if (cancelled) return;
        if (response.status === 410) {
          setVerificationState("expired");
          return;
        }
        if (response.ok && result.verified) {
          setVerificationState("verified");
          notifyCartAuthChanged();
          router.replace(safeNextPath(nextPath) || "/account");
          router.refresh();
          return;
        }
      } catch {
        // A transient network failure should not interrupt the verification flow.
      }
      if (!cancelled) timer = setTimeout(pollVerification, 3000);
    }

    timer = setTimeout(pollVerification, 1000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [mode, nextPath, router, signupSessionToken]);

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
    if (mode === "signup" && nextPath) payload.next = nextPath;

    if (mode === "signup" && payload.password !== payload.confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(endpoints[mode], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { error?: string; signupSessionToken?: string };
      if (!response.ok) throw new Error(result.error || "Something went wrong.");

      if (mode === "login") {
        notifyCartAuthChanged();
        const destination = safeNextPath(nextPath) || "/";
        router.push(destination);
        router.refresh();
      } else if (mode === "reset") {
        router.push("/account/login?reset=1");
      } else if (mode === "signup") {
        if (!result.signupSessionToken) throw new Error("Automatic verification sign-in could not be started.");
        setRegisteredEmail(payload.email);
        setSignupSessionToken(result.signupSessionToken);
        setVerificationState("waiting");
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

  if (mode === "signup" && registeredEmail) {
    return (
      <section
        className="account-created"
        ref={successPanelRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        <span className="account-created__icon" aria-hidden="true">✓</span>
        <h2>Account created!</h2>
        <p>
          We’ve sent a verification link to <strong>{registeredEmail}</strong>.
        </p>
        <p>
          Click the link to activate your account. Keep this page open and you’ll be signed in automatically and {nextPath
            ? "taken back to the tickets."
            : "taken to your account."}
        </p>
        <p className={`account-created__polling account-created__polling--${verificationState}`}>
          {verificationState === "verified"
            ? "Email verified — taking you to your account…"
            : verificationState === "expired"
              ? "Automatic sign-in has expired. Verify your email, then sign in normally."
              : "Waiting for email verification…"}
        </p>
        <p className="account-created__hint">Can’t see the email? Check your junk or spam folder.</p>
      </section>
    );
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
      {mode === "signup" ? (
        <label>
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
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
        {mode === "login" ? <Link className="account-form__create-link" href={nextPath ? `/account/signup?next=${encodeURIComponent(nextPath)}` : "/account/signup"}>Create an account</Link> : null}
      </div>
    </form>
  );
}
