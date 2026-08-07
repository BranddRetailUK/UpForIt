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
import {
  CART_AUTH_CHANGED_EVENT,
  CART_AUTH_SYNC_STORAGE_KEY,
  LEGACY_CART_STORAGE_KEY,
  LEGACY_CHECKOUT_INTENT_STORAGE_KEY,
  checkoutIntentStorageKey,
  userCartStorageKey
} from "../lib/cart-storage";
import { splitMerchProductTitle } from "../lib/product-title";
import MerchImage from "./MerchImage";

export type CartLine = {
  productId: string;
  productKind: string;
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
  ready: boolean;
  cartOwnerId: string | null;
  addLine: (line: CartLine) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
  replaceLines: (lines: CartLine[]) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function normalizeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((line) => line as Partial<CartLine>)
    .filter((line) => /^\d+$/.test(String(line.variantId || "")))
    .map((line) => ({
      productId: String(line.productId || ""),
      productKind: String(line.productKind || ""),
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
  const [cartOwnerId, setCartOwnerId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    let ownerId: string | null | undefined;
    let requestVersion = 0;
    let canonicalController: AbortController | null = null;

    try {
      window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    } catch {}
    try {
      window.sessionStorage.removeItem(LEGACY_CHECKOUT_INTENT_STORAGE_KEY);
    } catch {}

    const loadCartOwner = async (clearImmediately = false) => {
      const version = ++requestVersion;
      if (clearImmediately) {
        canonicalController?.abort();
        try {
          window.sessionStorage.removeItem(checkoutIntentStorageKey(ownerId));
          window.sessionStorage.removeItem(checkoutIntentStorageKey(null));
        } catch {}
        setHydrated(false);
        setLines([]);
        setDrawerOpen(false);
      }

      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok) throw new Error("Unable to confirm cart owner");
        const payload = await response.json() as { accountId?: unknown };
        const nextOwnerId = typeof payload.accountId === "string"
          ? payload.accountId
          : null;
        if (!active || version !== requestVersion) return;
        if (ownerId === nextOwnerId && !clearImmediately) return;

        ownerId = nextOwnerId;
        canonicalController?.abort();
        setHydrated(false);
        setCartOwnerId(nextOwnerId);
        setDrawerOpen(false);

        let restored: CartLine[] = [];
        const storageKey = userCartStorageKey(nextOwnerId);
        if (storageKey) {
          try {
            const stored = window.localStorage.getItem(storageKey);
            restored = normalizeLines(stored ? JSON.parse(stored) : []);
          } catch {}
        }
        setLines(restored);
        setHydrated(true);

        if (restored.length) {
          const controller = new AbortController();
          canonicalController = controller;
          void fetch("/api/merch/cart", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              items: restored.map((line) => ({
                variantId: line.variantId,
                quantity: line.quantity
              }))
            }),
            signal: controller.signal
          }).then(async (cartResponse) => {
            const cartPayload = await cartResponse.json();
            if (!cartResponse.ok) {
              throw new Error(cartPayload.error || "Unable to refresh cart");
            }
            if (active && version === requestVersion) {
              setLines(normalizeLines(cartPayload.lines));
            }
          }).catch((error) => {
            if (error?.name !== "AbortError") {
              console.warn("[merch-cart] canonical refresh failed");
            }
          });
        }
      } catch {
        if (!active || version !== requestVersion) return;
        ownerId = null;
        canonicalController?.abort();
        setCartOwnerId(null);
        setLines([]);
        setDrawerOpen(false);
        setHydrated(true);
      }
    };

    const onAuthChanged = () => void loadCartOwner(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_AUTH_SYNC_STORAGE_KEY) onAuthChanged();
    };
    const onFocus = () => void loadCartOwner();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadCartOwner();
    };

    void loadCartOwner();
    window.addEventListener(CART_AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      canonicalController?.abort();
      window.removeEventListener(CART_AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const storageKey = userCartStorageKey(cartOwnerId);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {}
  }, [cartOwnerId, hydrated, lines]);

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
    ready: hydrated,
    cartOwnerId,
    addLine,
    updateQuantity,
    removeLine,
    replaceLines: setLines,
    clearCart,
    openDrawer,
    closeDrawer
  }), [addLine, cartOwnerId, clearCart, closeDrawer, drawerOpen, hydrated, lines, openDrawer, removeLine, updateQuantity]);

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
      {lines.map((line) => {
        const { mainTitle, subtitle } = splitMerchProductTitle(line.title);
        return (
          <article className="cart-line" key={line.variantId}>
            {line.imageUrl ? (
              <MerchImage src={line.imageUrl} alt="" sizes={compact ? "92px" : "180px"} />
            ) : <div className="cart-line__empty-image" />}
            <div className="cart-line__copy">
              <Link
                className={`cart-line__title${subtitle ? " cart-line__title--split" : ""}`}
                href={`/merch/${line.slug}`}
              >
                <span className="cart-line__title-main">{mainTitle}</span>
                {subtitle && <span className="cart-line__title-subtitle">{subtitle}</span>}
              </Link>
              {line.variantLabel && <p className="cart-line__variant">{line.variantLabel}</p>}
              <strong>{new Intl.NumberFormat("en-GB", { style: "currency", currency: line.currency.toUpperCase() }).format(line.priceMinor / 100)}</strong>
              <div className="cart-line__controls">
                <button type="button" onClick={() => updateQuantity(line.variantId, line.quantity - 1)} aria-label={`Reduce ${line.title} quantity`}>−</button>
                <span>{line.quantity}</span>
                <button type="button" onClick={() => updateQuantity(line.variantId, line.quantity + 1)} aria-label={`Increase ${line.title} quantity`}>+</button>
                <button type="button" className="cart-line__remove" onClick={() => removeLine(line.variantId)}>Remove</button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
