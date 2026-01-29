"use client";

import { useState } from "react";

type FormStatus = "idle" | "loading" | "success" | "error";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

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

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data?.error || "Unable to sign up right now.");
      }

      setStatus("success");
      setMessage("Thanks! You're on the list.");
      setEmail("");
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Unable to sign up right now.";
      setStatus("error");
      setMessage(messageText);
    }
  };

  return (
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
  );
}
