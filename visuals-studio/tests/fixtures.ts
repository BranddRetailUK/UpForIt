import type { VisualJobV1 } from "../lib/contracts";

export function artistJob(overrides: Partial<VisualJobV1> = {}): VisualJobV1 {
  return {
    schemaVersion: 1,
    id: "11111111-1111-4111-8111-111111111111",
    name: "UPFORIT Artist Test",
    canvas: { width: 1920, height: 1080, fps: 50, durationSeconds: 20 },
    brand: { logoAssetId: "roundLogo", palette: "core" },
    content: {
      kind: "artist_batch",
      names: ["Scott Charles", "Spektral"],
      layouts: ["center", "top_third"],
      textAnimation: "flash_pulse",
      uppercase: true
    },
    motion: {
      preset: "pop-depth-loop",
      stylePreset: "website",
      intensity: 3,
      cameraStrength: 42,
      depthSpeed: 55,
      logoScale: 55,
      lightSweepAmount: 52,
      particleAmount: 40,
      glitchAmount: 60,
      logoCopies: 4,
      flashLevel: "medium",
      seamlessLoop: true
    },
    render: { preview: "h264-960x540", master: "prores-422-hq" },
    ...overrides
  };
}
