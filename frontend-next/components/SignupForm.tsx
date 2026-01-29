"use client";

import { useEffect, useState } from "react";

type FormStatus = "idle" | "loading" | "success" | "error";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (status !== "success") return;

    setShowModal(true);

    const tickDurationMs = 1200;
    const hideDelayMs = 3000;
    const timeout = window.setTimeout(() => {
      setShowModal(false);
    }, tickDurationMs + hideDelayMs);

    return () => window.clearTimeout(timeout);
  }, [status]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const text = await response.text();
      const data = text
        ? (JSON.parse(text) as { ok?: boolean; error?: string })
        : null;

      if (!response.ok) {
        throw new Error(data?.error || "Unable to sign up right now.");
      }

      setStatus("success");
      setMessage("");
      setEmail("");
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Unable to sign up right now.";
      setStatus("error");
      setMessage(messageText);
    }
  };

  return (
    <>
      <form className="signup-form" onSubmit={handleSubmit}>
        <input
          className="signup-input"
          type="email"
          name="email"
          placeholder="Enter your email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={status === "loading"}
        />
        <button className="btn btn--solid" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "SENDING..." : "SIGN UP"}
        </button>
        {message ? (
          <p
            className={`signup-message signup-message--${status}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        ) : null}
      </form>
      {showModal ? (
        <div className="signup-modal-overlay" role="presentation">
          <div className="signup-modal" role="dialog" aria-modal="true" aria-labelledby="signup-success-title">
            <div className="signup-modal__icon" aria-hidden="true">
              <svg className="signup-tick" viewBox="0 0 52 52">
                <circle className="signup-tick__circle" cx="26" cy="26" r="24" fill="none" />
                <path
                  className="signup-tick__check"
                  fill="none"
                  d="M14 27.5 L22 35 L38 18"
                />
              </svg>
            </div>
            <h3 className="signup-modal__title" id="signup-success-title">
              You're in.
            </h3>
            <p className="signup-modal__text">Thanks for signing up.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
