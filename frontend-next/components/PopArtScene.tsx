"use client";

import { useEffect, useRef } from "react";
import { CLOUDINARY_ASSETS } from "../lib/cloudinary";
import CloudinaryImage from "./CloudinaryImage";

const SMILEYS = [
  { className: "parallax-smiley--one", depth: 0.7, maxWidth: 360 },
  { className: "parallax-smiley--two", depth: 1.2, maxWidth: 300 },
  { className: "parallax-smiley--three", depth: 0.95, maxWidth: 260 },
  { className: "parallax-smiley--four", depth: 1.45, maxWidth: 220 }
];

const BURST_POINTS =
  "50,0 61,32 84,8 72,38 100,35 74,53 96,70 67,66 73,100 53,72 35,98 37,68 4,81 30,57 0,45 34,43 15,15 43,34";

export default function PopArtScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    if (reducedMotion.matches) return;

    const mobileViewport = window.matchMedia("(max-width: 720px)");

    const layers = Array.from(
      scene.querySelectorAll<HTMLElement>("[data-parallax-depth]")
    );
    let frame = 0;
    let lastFrameTime = 0;
    const getScrollShift = () => {
      const scrollRange = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange));
      return progress * -240;
    };

    let currentShift = getScrollShift();

    const paint = (time: number) => {
      const targetShift = getScrollShift();

      if (mobileViewport.matches) {
        const elapsed = lastFrameTime ? Math.min(time - lastFrameTime, 64) : 16;
        const easing = 1 - Math.exp(-elapsed / 55);
        currentShift += (targetShift - currentShift) * easing;
      } else {
        currentShift = targetShift;
      }

      layers.forEach((layer) => {
        const depth = Number(layer.dataset.parallaxDepth ?? 0);
        layer.style.setProperty("--smiley-y", `${currentShift * depth}px`);
      });

      lastFrameTime = time;
      frame = 0;

      if (Math.abs(targetShift - currentShift) > 0.1) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    const requestPaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    requestPaint();
    window.addEventListener("scroll", requestPaint, { passive: true });
    window.addEventListener("resize", requestPaint, { passive: true });
    mobileViewport.addEventListener("change", requestPaint);

    return () => {
      window.removeEventListener("scroll", requestPaint);
      window.removeEventListener("resize", requestPaint);
      mobileViewport.removeEventListener("change", requestPaint);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pop-art-scene" ref={sceneRef} aria-hidden="true">
      <div className="pop-art-backdrop" />
      <div className="scene-cloud scene-cloud--one" />
      <div className="scene-cloud scene-cloud--two" />
      <svg className="scene-burst scene-burst--one" viewBox="-5 -5 110 110">
        <polygon points={BURST_POINTS} />
      </svg>
      <svg className="scene-burst scene-burst--two" viewBox="-5 -5 110 110">
        <polygon points={BURST_POINTS} />
      </svg>
      <div className="scene-star scene-star--one" />
      <div className="scene-star scene-star--two" />
      <svg className="scene-bolt scene-bolt--one" viewBox="0 0 70 120">
        <path d="M42 2 5 67h27l-9 51 42-70H39z" />
      </svg>
      <svg className="scene-bolt scene-bolt--two" viewBox="0 0 70 120">
        <path d="M42 2 5 67h27l-9 51 42-70H39z" />
      </svg>

      {SMILEYS.map((smiley) => (
        <div
          className={`parallax-smiley ${smiley.className}`}
          data-parallax-depth={smiley.depth}
          key={smiley.className}
        >
          <CloudinaryImage
            asset={CLOUDINARY_ASSETS.smiley}
            alt=""
            className="parallax-smiley__image"
            sizes="(max-width: 720px) 140px, 260px"
            maxWidth={smiley.maxWidth}
          />
        </div>
      ))}
    </div>
  );
}
