"use client";

import { useRouter } from "next/navigation";

export default function ScannerEndAccessButton() {
  const router = useRouter();
  return <button className="text-button" type="button" onClick={async () => {
    await fetch("/api/scanner/logout", { method: "POST" });
    router.refresh();
  }}>End access on this device</button>;
}
