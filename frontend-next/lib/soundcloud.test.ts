import { describe, expect, it } from "vitest";
import { soundCloudLink } from "./soundcloud";
describe("SoundCloud public URL validation", () => {
  it("strips share tracking without changing the track", () => {
    expect(soundCloudLink("https://soundcloud.com/artist/mix?si=tracking#player")).toBe("https://soundcloud.com/artist/mix");
  });
  it.each(["http://soundcloud.com/artist/mix", "https://soundcloud.com.evil.test/mix", "https://localhost/mix", "https://user:password@soundcloud.com/mix", "https://soundcloud.com:8443/mix", "javascript:alert(1)"])("rejects unsafe URL %s", url => {
    expect(() => soundCloudLink(url)).toThrow();
  });
});

describe("waveform bar rendering", () => {
  it("preserves amplitude differences and outputs 180 bounded bars", async () => {
    const { waveformBars } = await import("./soundcloud");
    const bars = waveformBars([...Array(90).fill(20), ...Array(90).fill(100)], 100);
    expect(bars).toHaveLength(180);
    expect(bars[0]).toBe(2);
    expect(bars[179]).toBe(100);
  });
  it("handles missing or malformed provider data without inventing a waveform", async () => {
    const { waveformBars } = await import("./soundcloud");
    expect(waveformBars([], 100)).toEqual([]);
    expect(waveformBars([NaN], 100)).toEqual([]);
    expect(waveformBars([30], 0)).toEqual([]);
  });
});
