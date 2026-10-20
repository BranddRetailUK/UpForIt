"use client";
import { useEffect } from "react";
export default function ScannerActivationRedirect({ destination }: { destination: string }) {
  useEffect(() => {
    // Access keys live in the URL fragment and must never enter server logs.
    window.location.replace(destination + window.location.hash);
  }, [destination]);
  return <p>Opening scanner activation…</p>;
}
