import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MusicHub from "./MusicHub";
import { MUSIC_CONTENT } from "../lib/music";

describe("music media loading", () => {
  it("renders published players without metadata preloads or offscreen video posters", () => {
    const html = renderToStaticMarkup(<MusicHub blocks={MUSIC_CONTENT} />);
    const players = html.match(/<(?:video|audio)\b[^>]*>/g) || [];
    expect(players.length).toBeGreaterThan(0);
    for (const player of players) {
      expect(player).toContain('preload="none"');
      expect(player).not.toContain("poster=");
    }
    expect(html).toContain("q_auto:best/vc_h264/");
  });
});
