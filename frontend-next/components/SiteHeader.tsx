"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CLOUDINARY_ASSETS } from "../lib/cloudinary";
import { NAV_ITEMS } from "../lib/site";
import CloudinaryImage from "./CloudinaryImage";

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
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.body.classList.add("nav-open");
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
            alt=""
            className="brand-link__image brand-link__image--desktop"
            sizes="180px"
            maxWidth={360}
            priority
          />
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.roundLogo}
            alt=""
            className="brand-link__image brand-link__image--mobile"
            sizes="64px"
            maxWidth={240}
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
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    className={active ? "is-active" : undefined}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
