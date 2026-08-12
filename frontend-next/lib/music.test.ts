import { describe, expect, it } from "vitest";
import {
  filterMusicContent,
  MUSIC_CONTENT,
  type MusicContentBlock
} from "./music";
import { NAV_ITEMS } from "./site";

describe("music content catalogue", () => {
  it("keeps stable IDs unique", () => {
    const ids = MUSIC_CONTENT.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not request media for placeholder entries", () => {
    const placeholderMedia = MUSIC_CONTENT.filter(
      (block) =>
        (block.kind === "audio" || block.kind === "video") && block.placeholder
    );

    expect(placeholderMedia.length).toBeGreaterThan(0);
    expect(
      placeholderMedia.every(
        (block) => !("mediaPublicId" in block) || !block.mediaPublicId
      )
    ).toBe(true);
  });

  it("leads with Scott Charles's playable MiniMix video and audio", () => {
    const video = MUSIC_CONTENT[0];
    const audio = MUSIC_CONTENT.find((block) => block.id === "warm-up-audio");

    expect(video).toMatchObject({
      kind: "video",
      artist: "Scott Charles",
      mediaPublicId: "UpForIt_MiniMix_rhs1ez",
      placeholder: false
    });
    expect(audio).toMatchObject({
      kind: "audio",
      artist: "Scott Charles",
      mediaPublicId: "Scott_Charles_-_Up_For_It_MiniMix_2026_smkqax",
      placeholder: false
    });
  });

  it("preserves editorial order in the all view and removes stories from media filters", () => {
    expect(filterMusicContent(MUSIC_CONTENT, "all").map((block) => block.id)).toEqual(
      MUSIC_CONTENT.map((block) => block.id)
    );
    expect(filterMusicContent(MUSIC_CONTENT, "audio").every((block) => block.kind === "audio")).toBe(true);
    expect(filterMusicContent(MUSIC_CONTENT, "video").every((block) => block.kind === "video")).toBe(true);
    expect(filterMusicContent(MUSIC_CONTENT, "release").every((block) => block.kind === "release")).toBe(true);
  });

  it("places the Spektral feature after the lead video and includes it in the releases view", () => {
    expect(MUSIC_CONTENT[1]).toMatchObject({
      id: "spektral-married-to-the-music-grift",
      kind: "release",
      artist: "Spektral (UK)",
      label: "Koba Audio",
      artworkPublicId: "a1053183844_10_eahqtq",
      artistImagePublicId: "spektral_amzq4l",
      releaseUrl: "https://kobaaudio.bandcamp.com/album/married-to-the-music-grift"
    });
    expect(filterMusicContent(MUSIC_CONTENT, "release").map((block) => block.id)).toContain(
      "spektral-married-to-the-music-grift"
    );
  });

  it("returns an independent all-view array", () => {
    const blocks: MusicContentBlock[] = [MUSIC_CONTENT[0]];
    const result = filterMusicContent(blocks, "all");
    expect(result).toEqual(blocks);
    expect(result).not.toBe(blocks);
  });

  it("places the music route between events and merch in global navigation", () => {
    expect(NAV_ITEMS.slice(1, 4)).toEqual([
      { href: "/events", label: "Events" },
      { href: "/music", label: "Music & Mixes" },
      { href: "/merch", label: "Merch" }
    ]);
  });
});
