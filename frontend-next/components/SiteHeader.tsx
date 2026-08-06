"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CLOUDINARY_ASSETS } from "../lib/cloudinary";
import { PRIMARY_NAV_ITEMS } from "../lib/site";
import CloudinaryImage from "./CloudinaryImage";
import CartHeaderButton from "./CartHeaderButton";

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setHeaderHidden(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      setHeaderHidden(false);
      return;
    }

    let previousY = window.scrollY;
    let direction: -1 | 0 | 1 = 0;
    let distance = 0;
    let frame = 0;

    const updateHeader = () => {
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - previousY;

      if (currentY <= 8) {
        setHeaderHidden(false);
        direction = 0;
        distance = 0;
      } else if (Math.abs(delta) >= 1) {
        const nextDirection: -1 | 1 = delta > 0 ? 1 : -1;

        if (nextDirection !== direction) {
          direction = nextDirection;
          distance = 0;
        }

        distance += Math.abs(delta);

        if (distance >= 16) {
          setHeaderHidden(nextDirection === 1);
          distance = 0;
        }
      }

      previousY = currentY;
      frame = 0;
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateHeader);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [menuOpen]);

  useEffect(() => {
    document.body.classList.toggle("nav-open", menuOpen);

    if (!menuOpen) {
      return () => document.body.classList.remove("nav-open");
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.classList.remove("nav-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className={`site-header${headerHidden ? " is-hidden" : ""}`}>
      <div className="site-header__inner">
        <Link className="brand-link" href="/" aria-label="UPFORIT home">
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.navLogo}
            alt="UPFORIT"
            className="brand-link__image"
            sizes="(max-width: 760px) 142px, 180px"
            maxWidth={360}
            priority
          />
        </Link>

        <button
          className={`menu-toggle${menuOpen ? " is-open" : ""}`}
          type="button"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          className={`primary-nav${menuOpen ? " is-open" : ""}`}
          id="primary-navigation"
          aria-label="Primary navigation"
        >
          <ul>
            {PRIMARY_NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <li
                  className={item.href === "/account" ? "primary-nav__item--account" : undefined}
                  key={item.href}
                >
                  <Link
                    className={active ? "is-active" : undefined}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.href === "/account" ? "Account" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.href === "/account" ? (
                      <>
                        <span className="primary-nav__account-text">{item.label}</span>
                        <svg
                          className="primary-nav__account-icon"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4.5 21c.6-4.2 3.1-6.3 7.5-6.3s6.9 2.1 7.5 6.3" />
                        </svg>
                      </>
                    ) : item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="header-actions">
          <Link
            className={`header-profile${pathname.startsWith("/account") ? " is-active" : ""}`}
            href="/account"
            aria-label="Account"
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 21c.6-4.2 3.1-6.3 7.5-6.3s6.9 2.1 7.5 6.3" />
            </svg>
          </Link>
          <CartHeaderButton />
        </div>
      </div>
    </header>
  );
}
