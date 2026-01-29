"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type ParallaxBackgroundProps = {
  srcDesktop: string;
  srcMobile: string;
  blurDataURL?: string;
};

export default function ParallaxBackground({
  srcDesktop,
  srcMobile,
  blurDataURL
}: ParallaxBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      return;
    }

    let rafId = 0;

    const update = () => {
      if (!containerRef.current) {
        rafId = 0;
        return;
      }

      const scrollY = window.scrollY || window.pageYOffset;
      const offset = Math.min(140, scrollY * 0.144);
      containerRef.current.style.transform = `translate3d(0, ${offset}px, 0)`;
      rafId = 0;
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="flyer-media" aria-hidden="true">
      <Image
        src={srcDesktop}
        alt=""
        fill
        priority
        sizes="100vw"
        className="flyer-image flyer-image--desktop"
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
      />
      <Image
        src={srcMobile}
        alt=""
        fill
        sizes="100vw"
        className="flyer-image flyer-image--mobile"
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
      />
    </div>
  );
}
