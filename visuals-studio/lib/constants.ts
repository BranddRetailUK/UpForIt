import path from "node:path";
import os from "node:os";

const studioRoot = process.cwd();

export const STUDIO_ROOT = studioRoot;
export const RUNTIME_ROOT = path.resolve(/* turbopackIgnore: true */
  studioRoot,
  process.env.VISUALS_RUNTIME_ROOT || "runtime"
);
export const JOBS_ROOT = path.join(RUNTIME_ROOT, "jobs");
export const BRAND_CACHE_ROOT = path.join(RUNTIME_ROOT, "brand-cache");

export const AFTER_EFFECTS_APP =
  process.env.AFTER_EFFECTS_APP ||
  "/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects";
export const AFTER_EFFECTS_APP_NAME = process.env.AFTER_EFFECTS_APP_NAME || "Adobe After Effects 2026";
export const AFTER_EFFECTS_PROCESS_PATTERN =
  "^/Applications/Adobe After Effects 2026/Adobe After Effects 2026\\.app/Contents/MacOS/After Effects($| )";
export const AERENDER_PATH =
  process.env.AERENDER_PATH || "/Applications/Adobe After Effects 2026/aerender";
export const FFMPEG_PATH = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
export const FFPROBE_PATH =
  process.env.FFPROBE_PATH || path.join(path.dirname(FFMPEG_PATH), "ffprobe");
export const CODEX_PATH = process.env.CODEX_PATH || "codex";
export const FONT_SCAN_PATH = process.env.FONT_SCAN_PATH || "/opt/homebrew/bin/fc-scan";
export const AE_BRIDGE_PATH = path.join(STUDIO_ROOT, "ae", "build-visuals.jsx");

export const REQUIRED_FONT_POSTSCRIPT_NAME = "Panton-BlackCaps";
export const REQUIRED_FONT_PATH = path.join(os.homedir(), "Library", "Fonts", "Panton-BlackCaps.otf");
export const AE_PREFERENCES_PATH = path.join(
  os.homedir(),
  "Library", "Preferences", "Adobe", "After Effects", "26.3",
  "Adobe After Effects 26.3 Prefs.txt"
);
export const PORT = 4310;
