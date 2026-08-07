"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountProfileForm({
  displayName,
  email
}: {
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; displayName?: string };
      if (!response.ok) throw new Error(payload.error || "We could not update your account.");
      if (payload.displayName) setName(payload.displayName);
      setMessage("Account details updated.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We could not update your account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="account-form account-profile-form" onSubmit={submit}>
      <label>
        Display name
        <input
          name="displayName"
          value={name}
          minLength={2}
          maxLength={80}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label>
        Email address
        <input value={email} type="email" autoComplete="email" readOnly aria-readonly="true" />
        <small>Your verified sign-in email is managed securely.</small>
      </label>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <button className="pop-button pop-button--yellow" type="submit" disabled={saving || name.trim() === displayName}>
        {saving ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
