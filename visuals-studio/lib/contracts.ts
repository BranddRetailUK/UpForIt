export type BrandAssetId = "roundLogo" | "navLogo" | "smiley";
export type LogoAssetId = BrandAssetId | "none";
export type FlashLevel = "off" | "low" | "medium" | "high";
export type TextAnimation = "steady_glow" | "flash_pulse" | "punch_flash";
export type ArtistLayout = "center" | "top_third";
export type VisualStylePreset = "website" | "neon" | "spline";

export type VisualJobV1 = {
  schemaVersion: 1;
  id: string;
  name: string;
  canvas: {
    width: number;
    height: number;
    fps: 25 | 50;
    durationSeconds: 10 | 20 | 30;
  };
  brand: {
    logoAssetId: LogoAssetId;
    palette: "core";
  };
  content:
    | { kind: "logo_loop" }
    | {
        kind: "artist_batch";
        names: string[];
        layouts: ArtistLayout[];
        textAnimation: TextAnimation;
        uppercase: true;
      };
  motion: {
    preset: "pop-depth-loop";
    stylePreset: VisualStylePreset;
    intensity: 1 | 2 | 3 | 4 | 5;
    cameraStrength: number;
    depthSpeed: number;
    logoScale: number;
    lightSweepAmount: number;
    particleAmount: number;
    glitchAmount: number;
    logoCopies: number;
    flashLevel: FlashLevel;
    seamlessLoop: true;
  };
  render: {
    preview: "h264-960x540";
    master: "prores-422-hq";
  };
};

export type JobStatus =
  | "draft"
  | "building"
  | "rendering_preview"
  | "preview_ready"
  | "batch_building"
  | "batch_rendering"
  | "rendering_master"
  | "complete"
  | "failed"
  | "interrupted";

export type JobArtifact = {
  kind: "project" | "preview" | "poster" | "master" | "log" | "safety_report";
  label: string;
  path: string;
  url?: string;
  artist?: string;
  layout?: ArtistLayout;
};

export type StoredJob = VisualJobV1 & {
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  progress: number;
  statusMessage: string;
  error?: string;
  failedArtists: Array<{ name: string; error: string }>;
  artifacts: JobArtifact[];
};

export type AiAdjustment = {
  summary: string;
  patch: {
    brand?: { logoAssetId?: LogoAssetId };
    textAnimation?: TextAnimation;
    motion?: Partial<VisualJobV1["motion"]>;
  };
};

export type JobEvent = {
  jobId: string;
  at: string;
  status: JobStatus;
  progress: number;
  message: string;
};
