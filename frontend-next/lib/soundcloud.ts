// Server-side only: never return OAuth tokens or app credentials to the browser.
import { createHash } from "node:crypto";

type Token = { access_token: string; refresh_token?: string; expiresAt: number };
const state = globalThis as typeof globalThis & { scToken?: Token; scPending?: Promise<Token>; scKey?: string };
export function soundCloudLink(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"].includes(url.hostname) || url.username || url.password || url.port) throw new Error("Enter a public SoundCloud track link.");
  url.search = ""; url.hash = "";
  return url.toString();
}
async function token() {
  const id = process.env.SOUNDCLOUD_CLIENT_ID;
  const secret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  if (!id || !secret) throw new Error("SoundCloud is not configured.");
  const key = createHash("sha256").update(`${id}:${secret}`).digest("hex");
  if (state.scKey !== key) { state.scKey = key; state.scToken = undefined; state.scPending = undefined; }
  if (state.scToken && state.scToken.expiresAt > Date.now() + 60000) return state.scToken;
  if (!state.scPending) state.scPending = (async () => {
    const refresh = state.scToken?.refresh_token;
    const body = new URLSearchParams(refresh ? { grant_type: "refresh_token", refresh_token: refresh, client_id: id, client_secret: secret } : { grant_type: "client_credentials" });
    const response = await fetch("https://secure.soundcloud.com/oauth/token", { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("SoundCloud authentication is unavailable. Please try again later.");
    const data = await response.json();
    if (!data.access_token) throw new Error("SoundCloud authentication is unavailable.");
    state.scToken = { access_token: data.access_token, refresh_token: data.refresh_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
    return state.scToken;
  })().finally(() => { state.scPending = undefined; });
  return state.scPending;
}
async function api(path: string) {
  let url = new URL(path, "https://api.soundcloud.com");
  for (let i = 0; i < 4; i++) {
    if (url.origin !== "https://api.soundcloud.com") throw new Error("Invalid SoundCloud response.");
    const response = await fetch(url, { headers: { Authorization: `OAuth ${(await token()).access_token}` }, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(12000) });
    if ([301,302,303,307,308].includes(response.status)) { url = new URL(response.headers.get("location") || "", url); continue; }
    if (!response.ok) throw new Error("This SoundCloud mix could not be loaded. Check that it is public.");
    return response.json();
  }
  throw new Error("SoundCloud returned too many redirects.");
}
function cdnUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && (url.hostname.endsWith(".sndcdn.com") || url.hostname === "playback.media-streaming.soundcloud.cloud") ? value : null; } catch { return null; }
}
// Render the provider's real amplitude samples with the same 180-bar layout as uploads.
export function waveformBars(samples: unknown, height: unknown): number[] {
  if (!Array.isArray(samples) || !samples.length || samples.length > 20000 || typeof height !== "number" || !Number.isFinite(height) || height <= 0 || samples.some(n => typeof n !== "number" || !Number.isFinite(n) || n < 0)) return [];
  return Array.from({ length: 180 }, (_, index) => {
    const start = Math.floor(index * samples.length / 180);
    const end = Math.max(start + 1, Math.floor((index + 1) * samples.length / 180));
    const section = samples.slice(start, end) as number[];
    const amplitude = Math.sqrt(section.reduce((sum, n) => sum + n * n, 0) / section.length);
    return Math.max(2, Math.min(100, Math.round(Math.pow(Math.min(1, amplitude / height), 2.5) * 100)));
  });
}
async function loadWaveform(value: unknown): Promise<number[]> {
  const safe = cdnUrl(value);
  if (!safe) return [];
  const url = new URL(safe);
  if (url.hostname !== "wave.sndcdn.com" || !url.pathname.endsWith(".png")) return [];
  url.pathname = url.pathname.replace(/\.png$/, ".json");
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const data = await response.json();
    return waveformBars(data.samples, data.height);
  } catch { return []; }
}
export async function resolveSoundCloud(value: string) {
  const link = soundCloudLink(value);
  const track = await api(`/resolve?url=${encodeURIComponent(link)}`);
  if (track.kind !== "track" || track.sharing !== "public" || !/^soundcloud:tracks:\d+$/.test(track.urn)) throw new Error("Use a public individual track link, not a profile or playlist.");
  const playable = track.access === "playable" && track.streamable !== false;
  const streams = playable ? await api(`/tracks/${encodeURIComponent(track.urn)}/streams`) : {};
  let stream: string | null = null;
  const candidate = streams.hls_aac_160_url || streams.hls_mp3_128_url;
  if (typeof candidate === "string") {
    const source = new URL(candidate);
    if (source.origin === "https://api.soundcloud.com") {
      const response = await fetch(source, { headers: { Authorization: `OAuth ${(await token()).access_token}` }, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(12000) });
      if ([301,302,303,307,308].includes(response.status)) stream = cdnUrl(response.headers.get("location"));
      else if (response.ok && response.headers.get("content-type")?.includes("json")) stream = cdnUrl((await response.json()).url);
    } else stream = cdnUrl(candidate);
  }
  return { title: String(track.title), artist: String(track.user?.username || "SoundCloud artist"), permalink: soundCloudLink(track.permalink_url), waveform: cdnUrl(track.waveform_url), bars: await loadWaveform(track.waveform_url), stream, duration: Number(track.duration) / 1000, playable: !!stream };
}
