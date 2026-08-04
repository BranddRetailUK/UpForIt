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

export default function PopArtScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    if (reducedMotion.matches) return;

    const layers = Array.from(
      scene.querySelectorAll<HTMLElement>("[data-parallax-depth]")
    );
    let frame = 0;

    const paint = () => {
      const scrollShift = Math.max(-240, Math.min(0, window.scrollY * -0.22));
      layers.forEach((layer) => {
        const depth = Number(layer.dataset.parallaxDepth ?? 0);
        layer.style.setProperty("--smiley-y", `${scrollShift * depth}px`);
      });
      frame = 0;
    };

    const requestPaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener("scroll", requestPaint, { passive: true });

    return () => {
      window.removeEventListener("scroll", requestPaint);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="pop-art-scene" ref={sceneRef} aria-hidden="true">
      <div className="pop-art-backdrop" />
      <div className="scene-cloud scene-cloud--one" />
      <div className="scene-cloud scene-cloud--two" />
      <div className="scene-burst scene-burst--one" />
      <div className="scene-burst scene-burst--two" />
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
