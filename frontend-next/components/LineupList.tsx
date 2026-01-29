"use client";

import { useEffect, useRef } from "react";

type LineupListProps = {
  rows: string[][];
};

export default function LineupList({ rows }: LineupListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leadNames = new Set(["Spektral", "Chippa"]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId = 0;

    const updateDividers = () => {
      const rowEls = Array.from(
        container.querySelectorAll<HTMLElement>(".lineup-row")
      );

      rowEls.forEach((rowEl) => {
        const items = Array.from(
          rowEl.querySelectorAll<HTMLElement>(".lineup-item")
        );

        items.forEach((item, index) => {
          const divider = item.querySelector<HTMLElement>(".lineup-divider");
          if (!divider) return;

          const next = items[index + 1];
          if (!next) {
            divider.style.visibility = "hidden";
            return;
          }

          const wrapped = next.offsetTop > item.offsetTop + 1;
          divider.style.visibility = wrapped ? "hidden" : "visible";
        });
      });
    };

    const scheduleUpdate = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(updateDividers);
    };

    scheduleUpdate();

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(container);
    window.addEventListener("resize", scheduleUpdate);

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleUpdate).catch(() => {});
    }

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver.disconnect();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [rows]);

  return (
    <div ref={containerRef} className="lineup-rows">
      {rows.map((row, rowIndex) => (
        <div className="lineup-row" key={`row-${rowIndex}`}>
          {row.map((artist, index) => (
            <div className="lineup-item" key={artist}>
              <span
                className={`lineup-name${leadNames.has(artist) ? " lineup-name--lead" : ""}`}
              >
                {artist}
              </span>
              {index < row.length - 1 ? (
                <span className="lineup-divider" aria-hidden="true">
                  |
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
