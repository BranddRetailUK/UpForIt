"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import MerchImage from "./MerchImage";

export type CartLine = {
  productId: string;
  variantId: string;
  slug: string;
  title: string;
  variantLabel: string;
  imageUrl: string;
  priceMinor: number;
  currency: string;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  drawerOpen: boolean;
  addLine: (line: CartLine) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
  replaceLines: (lines: CartLine[]) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const STORAGE_KEY = "upforit.merch.cart.v1";
const CartContext = createContext<CartContextValue | null>(null);

function normalizeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => line as Partial<CartLine>)
    .filter((line) => /^\d+$/.test(String(line.variantId || "")))
    .map((line) => ({
      productId: String(line.productId || ""),
      variantId: String(line.variantId || ""),
      slug: String(line.slug || ""),
      title: String(line.title || "Merch item"),
      variantLabel: String(line.variantLabel || ""),
      imageUrl: String(line.imageUrl || ""),
      priceMinor: Math.max(0, Number(line.priceMinor || 0)),
      currency: String(line.currency || "gbp"),
      quantity: Math.min(20, Math.max(1, Math.trunc(Number(line.quantity || 1))))
    }));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let restored: CartLine[] = [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      restored = normalizeLines(stored ? JSON.parse(stored) : []);
      setLines(restored);
    } catch {
      setLines([]);
    }
    setHydrated(true);
    if (restored.length) {
      void fetch("/api/merch/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: restored.map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
        }),
        signal: controller.signal
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to refresh cart");
        if (active) setLines(normalizeLines(payload.lines));
      }).catch((error) => {
        if (error?.name !== "AbortError") console.warn("[merch-cart] canonical refresh failed");
      });
    }
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [hydrated, lines]);

  useEffect(() => {
    document.body.classList.toggle("cart-open", drawerOpen);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("cart-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const addLine = useCallback((line: CartLine) => {
    setLines((current) => {
      const existing = current.find((item) => item.variantId === line.variantId);
      if (!existing) return [...current, { ...line, quantity: Math.min(20, Math.max(1, line.quantity)) }];
      return current.map((item) =>
        item.variantId === line.variantId
          ? { ...line, quantity: Math.min(20, item.quantity + Math.max(1, line.quantity)) }
          : item
      );
    });
    setDrawerOpen(true);
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity < 1) {
      setLines((current) => current.filter((line) => line.variantId !== variantId));
      return;
    }
    setLines((current) => current.map((line) =>
      line.variantId === variantId
        ? { ...line, quantity: Math.min(20, Math.max(1, Math.trunc(quantity))) }
        : line
    ));
  }, []);

  const removeLine = useCallback((variantId: string) => {
    setLines((current) => current.filter((line) => line.variantId !== variantId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    drawerOpen,
    addLine,
    updateQuantity,
    removeLine,
    replaceLines: setLines,
    clearCart,
    openDrawer,
    closeDrawer
  }), [addLine, clearCart, closeDrawer, drawerOpen, lines, openDrawer, removeLine, updateQuantity]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <div
        className={`cart-backdrop${drawerOpen ? " is-open" : ""}`}
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`cart-drawer${drawerOpen ? " is-open" : ""}`} aria-hidden={!drawerOpen} aria-label="Shopping cart">
        <div className="cart-drawer__head">
          <div>
            <p className="comic-kicker comic-kicker--pink">Your haul</p>
            <h2>Cart</h2>
          </div>
          <button type="button" className="cart-drawer__close" onClick={() => setDrawerOpen(false)} aria-label="Close cart">×</button>
        </div>
        <CartLines compact />
        {lines.length > 0 && (
          <div className="cart-drawer__actions">
            <Link className="pop-button pop-button--pink" href="/cart" onClick={() => setDrawerOpen(false)}>View cart & checkout</Link>
            <p>UK delivery only. Secure payment by Stripe.</p>
          </div>
        )}
      </aside>
    </CartContext.Provider>
  );
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}

export function CartLines({ compact = false }: { compact?: boolean }) {
  const { lines, updateQuantity, removeLine } = useCart();
  if (!lines.length) {
    return (
      <div className="cart-empty">
        <span aria-hidden="true">!</span>
        <h3>Your cart is empty</h3>
        <Link href="/merch">Find some fresh gear</Link>
      </div>
    );
  }
  return (
    <div className={`cart-lines${compact ? " is-compact" : ""}`}>
      {lines.map((line) => (
        <article className="cart-line" key={line.variantId}>
          {line.imageUrl ? (
            <MerchImage src={line.imageUrl} alt="" sizes={compact ? "92px" : "180px"} />
          ) : <div className="cart-line__empty-image" />}
          <div className="cart-line__copy">
            <Link href={`/merch/${line.slug}`}>{line.title}</Link>
            {line.variantLabel && <p>{line.variantLabel}</p>}
            <strong>{new Intl.NumberFormat("en-GB", { style: "currency", currency: line.currency.toUpperCase() }).format(line.priceMinor / 100)}</strong>
            <div className="cart-line__controls">
              <button type="button" onClick={() => updateQuantity(line.variantId, line.quantity - 1)} aria-label={`Reduce ${line.title} quantity`}>−</button>
              <span>{line.quantity}</span>
              <button type="button" onClick={() => updateQuantity(line.variantId, line.quantity + 1)} aria-label={`Increase ${line.title} quantity`}>+</button>
              <button type="button" className="cart-line__remove" onClick={() => removeLine(line.variantId)}>Remove</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
