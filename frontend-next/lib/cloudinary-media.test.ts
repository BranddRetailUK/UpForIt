import { describe, expect, it } from "vitest";
import {
  cloudinaryArtworkUrl,
  cloudinaryAudioDownloadUrl,
  cloudinaryAudioUrl,
  cloudinaryVideoPosterUrl,
  cloudinaryVideoUrl,
  safeCloudinaryDownloadName
} from "./cloudinary";

describe("Cloudinary music delivery URLs", () => {
  it("builds audio and video streaming URLs for nested public IDs", () => {
    expect(cloudinaryAudioUrl("UPFORIT/mixes/opening set")).toBe(
      "https://res.cloudinary.com/brandduk/video/upload/f_mp3,q_auto/UPFORIT/mixes/opening%20set.mp3"
    );
    expect(cloudinaryVideoUrl("UPFORIT/videos/main-room", "webm")).toBe(
      "https://res.cloudinary.com/brandduk/video/upload/UPFORIT/videos/main-room.webm"
    );
  });

  it("requests subject-aware artwork crops without needing the source format", () => {
    expect(cloudinaryArtworkUrl("UPFORIT/artwork/mix-one", { width: 900, height: 900 })).toBe(
      "https://res.cloudinary.com/brandduk/image/upload/f_auto,q_auto,c_fill,g_auto,w_900,h_900/UPFORIT/artwork/mix-one"
    );
  });

  it("generates a first-frame poster from a video public ID", () => {
    expect(cloudinaryVideoPosterUrl("UPFORIT/videos/main-room", { width: 1280, height: 720 })).toBe(
      "https://res.cloudinary.com/brandduk/video/upload/f_jpg,q_auto,so_0,c_fill,g_auto,w_1280,h_720/UPFORIT/videos/main-room.jpg"
    );
  });

  it("creates attachment delivery URLs with safe filenames", () => {
    expect(safeCloudinaryDownloadName("  UPFORIT: Déjà Vu!.WAV  ")).toBe(
      "upforit-deja-vu"
    );
    expect(cloudinaryAudioDownloadUrl("UPFORIT/mixes/deja-vu", "UPFORIT: Déjà Vu!.WAV")).toBe(
      "https://res.cloudinary.com/brandduk/video/upload/fl_attachment:upforit-deja-vu,f_mp3,q_auto/UPFORIT/mixes/deja-vu.mp3"
    );
  });

  it("falls back to a stable download name when a title has no safe characters", () => {
    expect(safeCloudinaryDownloadName("★★★")).toBe("upforit-mix");
  });
});
