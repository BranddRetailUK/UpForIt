"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="pop-button pop-button--pink"
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/account/login");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
