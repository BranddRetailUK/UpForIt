import { access, readFile, statfs } from "node:fs/promises";
import path from "node:path";
import {
  AE_PREFERENCES_PATH,
  AERENDER_PATH,
  AFTER_EFFECTS_APP,
  AFTER_EFFECTS_PROCESS_PATTERN,
  CODEX_PATH,
  FFMPEG_PATH,
  FONT_SCAN_PATH,
  REQUIRED_FONT_PATH,
  REQUIRED_FONT_POSTSCRIPT_NAME,
  RUNTIME_ROOT
} from "./constants";
import { getBrandStatus } from "./brand";
import { runProcess } from "./process";
import { getActiveJobId } from "./jobs";

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function toolStatus(name: string, command: string, args: string[], requirePath = false) {
  if (requirePath && !(await pathExists(command))) {
    return { name, ready: false, version: "", path: command, message: "Not found" };
  }
  try {
    const result = await runProcess(command, args, { timeoutMs: 8_000 });
    const version = (result.stdout || result.stderr).split(/\r?\n/).find(Boolean)?.trim() || "Available";
    return { name, ready: true, version, path: command, message: "Ready" };
  } catch (error) {
    return {
      name,
      ready: false,
      version: "",
      path: command,
      message: error instanceof Error ? error.message : "Unavailable"
    };
  }
}

async function applicationStatus(name: string, applicationPath: string) {
  const ready = await pathExists(applicationPath);
  return {
    name,
    ready,
    version: ready ? "Adobe After Effects 2026" : "",
    path: applicationPath,
    message: ready ? "Ready" : "Not found"
  };
}

async function aerenderStatus() {
  if (!(await pathExists(AERENDER_PATH))) {
    return { name: "aerender", ready: false, version: "", path: AERENDER_PATH, message: "Not found" };
  }
  try {
    const result = await runProcess(AERENDER_PATH, ["-version"], { timeoutMs: 8_000 });
    const version = (result.stdout || result.stderr).split(/\r?\n/).find(Boolean)?.trim() || "Adobe aerender";
    return { name: "aerender", ready: true, version, path: AERENDER_PATH, message: "Ready" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reportedVersion = message.match(/aerender version [^\r\n]+/i)?.[0];
    if (reportedVersion) {
      return { name: "aerender", ready: true, version: reportedVersion, path: AERENDER_PATH, message: "Ready" };
    }
    return { name: "aerender", ready: false, version: "", path: AERENDER_PATH, message: message || "Unavailable" };
  }
}

export async function isAfterEffectsRunning() {
  try {
    const result = await runProcess(
      "pgrep",
      ["-f", AFTER_EFFECTS_PROCESS_PATTERN],
      { timeoutMs: 3_000 }
    );
    return result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function scriptingPreferenceStatus() {
  try {
    const contents = await readFile(AE_PREFERENCES_PATH, "utf8");
    const enabled = /"Pref_SCRIPTING_FILE_NETWORK_SECURITY"\s*=\s*"1"/.test(contents);
    return {
      ready: enabled,
      path: AE_PREFERENCES_PATH,
      message: enabled ? "File/network scripting enabled" : "Enable file/network scripting in After Effects settings"
    };
  } catch {
    return { ready: false, path: AE_PREFERENCES_PATH, message: "After Effects preference file not found" };
  }
}

export function hasExactPostscriptFont(scanOutput: string, requiredName = REQUIRED_FONT_POSTSCRIPT_NAME) {
  return scanOutput.split(/[\s,]+/).filter(Boolean).includes(requiredName);
}

async function fontStatus() {
  if (!(await pathExists(REQUIRED_FONT_PATH))) {
    return {
      ready: false,
      postscriptName: REQUIRED_FONT_POSTSCRIPT_NAME,
      path: REQUIRED_FONT_PATH,
      message: "Required artist font file is not installed"
    };
  }
  try {
    const result = await runProcess(
      FONT_SCAN_PATH,
      ["--format", "%{postscriptname}\n", REQUIRED_FONT_PATH],
      { timeoutMs: 8_000 }
    );
    const postscriptNames = result.stdout.split(/[\s,]+/).filter(Boolean);
    const ready = hasExactPostscriptFont(result.stdout);
    return {
      ready,
      postscriptName: REQUIRED_FONT_POSTSCRIPT_NAME,
      path: REQUIRED_FONT_PATH,
      message: ready ? "Exact PostScript font is ready" : `Expected ${REQUIRED_FONT_POSTSCRIPT_NAME}; found ${postscriptNames.join(", ") || "no PostScript name"}`
    };
  } catch (error) {
    return {
      ready: false,
      postscriptName: REQUIRED_FONT_POSTSCRIPT_NAME,
      path: REQUIRED_FONT_PATH,
      message: error instanceof Error ? `Unable to validate the installed font: ${error.message}` : "Unable to validate the installed font"
    };
  }
}

export async function getSystemStatus() {
  const [afterEffects, aerender, ffmpeg, codex, font, preference, brand, aeRunning] = await Promise.all([
    applicationStatus("After Effects", AFTER_EFFECTS_APP),
    aerenderStatus(),
    toolStatus("FFmpeg", FFMPEG_PATH, ["-version"], true),
    toolStatus("Codex", CODEX_PATH, ["--version"]),
    fontStatus(),
    scriptingPreferenceStatus(),
    getBrandStatus(),
    isAfterEffectsRunning()
  ]);

  let freeBytes = 0;
  try {
    const fsInfo = await statfs(path.dirname(RUNTIME_ROOT));
    freeBytes = Number(fsInfo.bavail) * Number(fsInfo.bsize);
  } catch {
    freeBytes = 0;
  }

  return {
    tools: { afterEffects, aerender, ffmpeg, codex },
    font,
    scriptingPreference: preference,
    brand,
    disk: {
      ready: freeBytes >= 20 * 1024 ** 3,
      freeBytes,
      message: freeBytes ? `${(freeBytes / 1024 ** 3).toFixed(1)} GB free` : "Unable to read free space"
    },
    afterEffectsRunning: aeRunning,
    activeJobId: getActiveJobId(),
    outputTemplate: {
      ready: true,
      name: "Lossless",
      message: "Verified by the AE bridge before each build"
    }
  };
}
