export const COMPETITION_ID = "nye-2026";
export const MIX_GENRES = ["Dubstep", "Grime", "UKG", "Garage", "House", "Multi-genre", "Other"] as const;
export type MixEntry = { id: string; artist: string; title: string; genre: string; source: "Upload" | "Link"; mark: string; audio: string; url: string; note: string; allowDownload: boolean; originalFileUrl?: string; originalFilename?: string; soundcloud?: string; waveform?: string };
export type CompetitionSettings = { submissions_open: boolean; voting_open: boolean; submissions_close_at: string; voting_close_at: string; announce_at: string; winner_entry_id: string | null };
export type CompetitionData = { entries: MixEntry[]; settings: CompetitionSettings; submissionsOpen: boolean; votingOpen: boolean; winner: MixEntry | null; tied: boolean; currentVote: string | null; signedIn: boolean; verified: boolean; email: string; hasEntry: boolean };
export function submissionsAllowed(s: CompetitionSettings, now = Date.now()) { return s.submissions_open && now < Date.parse(s.submissions_close_at); }
export function votingAllowed(s: CompetitionSettings, now = Date.now()) { return s.voting_open && now < Date.parse(s.voting_close_at); }
export function validMixEmail(value: unknown): value is string { return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function cleanMixLink(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Enter a SoundCloud mix link.");
  const u = new URL(value);
  if (u.protocol !== "https:" || !["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"].includes(u.hostname) || u.port || u.username || u.password) throw new Error("Enter a public SoundCloud mix link.");
  u.search = ""; u.hash = "";
  return u.toString();
}
export function validateMixDetails(body: Record<string, unknown>) {
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const genre = String(body.genre || "");
  if (!artist || artist.length > 80 || !title || title.length > 120 || !MIX_GENRES.includes(genre as typeof MIX_GENRES[number]) || !validMixEmail(email)) throw new Error("Enter an artist name, mix title, genre and valid contact email.");
  if (!["Upload", "Link"].includes(String(body.source))) throw new Error("Choose Upload or Link.");
  return { artist, title, email, genre, source: body.source as "Upload" | "Link" };
}
export function csvCell(value: unknown) { const text = String(value ?? ""); return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`; }
