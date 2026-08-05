"use client";

import { useState } from "react";

export default function AdminResendButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <button className="text-button" disabled={state === "busy"} type="button" onClick={async () => {
      setState("busy");
      const response = await fetch(`/api/admin/orders/${orderId}/resend`, { method: "POST" });
      setState(response.ok ? "done" : "error");
    }}>
      {state === "busy" ? "Queueing…" : state === "done" ? "Queued" : state === "error" ? "Failed" : "Resend tickets"}
    </button>
  );
}
