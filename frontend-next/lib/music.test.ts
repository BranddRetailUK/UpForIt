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
      (block) => block.kind !== "artist-story" && block.placeholder
    );

    expect(placeholderMedia.length).toBeGreaterThan(0);
    expect(
      placeholderMedia.every(
        (block) => block.kind === "artist-story" || !block.mediaPublicId
      )
    ).toBe(true);
  });

  it("leads with Scott Charles's playable MiniMix video and audio", () => {
    const [video, audio] = MUSIC_CONTENT;

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
  });

  it("returns an independent all-view array", () => {
    const blocks: MusicContentBlock[] = [MUSIC_CONTENT[0]];
    const result = filterMusicContent(blocks, "all");
    expect(result).toEqual(blocks);
    expect(result).not.toBe(blocks);
  });

  it("keeps the music route out of global navigation until launch", () => {
    expect(NAV_ITEMS.map((item) => String(item.href))).not.toContain("/music");
  });
});
