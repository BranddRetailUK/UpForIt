"use client";

import { useCart } from "./CartProvider";

export default function CartHeaderButton() {
  const { count, openDrawer } = useCart();
  return (
    <button className="header-cart" type="button" onClick={openDrawer} aria-label={`Open cart, ${count} items`}>
      Cart <span>{count}</span>
    </button>
  );
}
