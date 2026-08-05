"use client";

import { useState } from "react";

export default function AdminTierToggle({ id, initialActive }: { id: string; initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const response = await fetch(`/api/admin/ticket-types/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !active })
    });
    if (response.ok) setActive(!active);
    setBusy(false);
  }
  return <button className={`status-toggle ${active ? "is-active" : ""}`} type="button" disabled={busy} onClick={toggle}>{busy ? "Saving…" : active ? "On sale" : "Off sale"}</button>;
}

