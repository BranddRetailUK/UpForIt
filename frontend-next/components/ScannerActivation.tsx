"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ScannerActivation({ mode = "enrol" }: { mode?: "enrol" | "relink" }) {
  const router = useRouter();
  const initialized = useRef(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const value = params.get("token") || "";
    setToken(value);
    window.history.replaceState(null, "", "/scan/activate");
    if (!value) setError("This scanner QR is missing its access key. Ask Scott to show a new QR.");
    else if (mode === "relink") void activateToken(value, "");
  }, [mode]);

  async function activateToken(tokenValue: string, label: string) {
    if (!tokenValue) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/scanner/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tokenValue, label, mode })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error || "Scanner access could not be activated.");
        return;
      }
      setToken("");
      router.replace("/scan");
      router.refresh();
    } catch {
      setError("Connection lost. Check the signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await activateToken(token, String(data.get("label") || ""));
  }

  if (mode === "relink") {
    return (
      <div className="account-form scanner-activation">
        <button className="pop-button pop-button--yellow" type="button" disabled={!token || busy} onClick={() => void activateToken(token, "")}>
          {busy ? "Relinking…" : "Relink scanner"}
        </button>
        {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      </div>
    );
  }

  return (
    <form className="account-form scanner-activation" onSubmit={activate}>
      <label>
        Your name or device label <small>Optional — this helps Scott identify the device.</small>
        <input name="label" maxLength={60} placeholder="e.g. Sarah or Front door iPhone" autoComplete="off" />
      </label>
      <button className="pop-button pop-button--yellow" type="submit" disabled={!token || busy}>
        {busy ? "Activating…" : "Start scanning"}
      </button>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    </form>
  );
}
