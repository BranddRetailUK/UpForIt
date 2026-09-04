import { describe, expect, it } from "vitest";
import { validateLoopBoundaryScore, validateMediaProbe } from "../lib/media";

describe("rendered media preflight", () => {
  it("accepts the locked H.264 preview profile", () => {
    expect(validateMediaProbe({
      streams: [{
        codec_type: "video", codec_name: "h264", width: 960, height: 540,
        pix_fmt: "yuv420p", r_frame_rate: "50/1", nb_read_frames: "1000"
      }],
      format: { duration: "20.000000" }
    }, {
      codec: "h264", width: 960, height: 540, fps: 50,
      durationSeconds: 20, pixelFormat: "yuv420p"
    }).frameCount).toBe(1000);
  });

  it("accepts ProRes 422 HQ and rejects a codec or frame-rate mismatch", () => {
    const probe = {
      streams: [{
        codec_type: "video", codec_name: "prores", profile: "HQ", width: 1920, height: 1080,
        pix_fmt: "yuv422p10le", r_frame_rate: "50/1", nb_read_frames: "1000"
      }],
      format: { duration: "20.000000" }
    };
    const expected = {
      codec: "prores" as const, profile: "HQ" as const, width: 1920, height: 1080,
      fps: 50 as const, durationSeconds: 20 as const, pixelFormat: "yuv422p10le" as const
    };
    expect(() => validateMediaProbe(probe, expected)).not.toThrow();
    expect(() => validateMediaProbe(probe, { ...expected, fps: 25 })).toThrow(/25fps/);
  });

  it("enforces the loop-boundary frame-difference threshold", () => {
    expect(validateLoopBoundaryScore(0.79).score).toBe(0.79);
    expect(validateLoopBoundaryScore(12, 6).allowedDifference).toBe(15.5);
    expect(() => validateLoopBoundaryScore(16, 6)).toThrow(/Loop boundary/);
    expect(() => validateLoopBoundaryScore(5.01)).toThrow(/Loop boundary/);
  });
});
