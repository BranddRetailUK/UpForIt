"use client";

import { useRouter } from "next/navigation";
import { notifyCartAuthChanged } from "../lib/cart-storage";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="pop-button pop-button--pink"
      type="button"
      onClick={async () => {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (response.ok) notifyCartAuthChanged();
        router.push("/account/login");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
