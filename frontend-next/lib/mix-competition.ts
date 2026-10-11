import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "./db";
import type { AuthUser } from "./auth";
import { COMPETITION_ID, CompetitionSettings, MixEntry, submissionsAllowed, votingAllowed } from "./mix-shared";
export type EntryRow = { id: string; artist: string; title: string; genre: string; email: string; source: "Upload" | "Link"; source_url: string | null; audio_url: string | null; original_filename: string | null; allow_download: boolean; waveform_url: string | null; status: string; user_id: string; created_at: Date; votes?: string };
export function publicEntry(row: EntryRow): MixEntry {
  return { id: row.id, artist: row.artist, title: row.title, genre: row.genre, source: row.source, mark: row.artist.slice(0,2).toUpperCase(), audio: row.source === "Upload" ? row.audio_url || "" : "", url: row.source_url || "", soundcloud: row.source === "Link" ? row.source_url || undefined : undefined, waveform: row.waveform_url || undefined, note: "", allowDownload: row.allow_download, originalFileUrl: row.allow_download ? `/api/competition/download/${row.id}` : undefined, originalFilename: row.original_filename || undefined };
}
export async function competitionSettings(db: Pick<PoolClient, "query"> = getPool(), lock = false): Promise<CompetitionSettings> {
  const r = await db.query("SELECT * FROM mix_competitions WHERE id=$1" + (lock ? " FOR UPDATE" : ""), [COMPETITION_ID]);
  if (!r.rows[0]) throw new Error("Competition unavailable.");
  const s = r.rows[0];
  return {...s,submissions_close_at:new Date(s.submissions_close_at).toISOString(),voting_close_at:new Date(s.voting_close_at).toISOString(),announce_at:new Date(s.announce_at).toISOString()};
}
export async function competitionData(user: AuthUser | null) {
  const db = getPool(); const settings = await competitionSettings();
  const result = await db.query<EntryRow>("SELECT * FROM mix_entries WHERE competition_id=$1 AND status='published' ORDER BY created_at DESC", [COMPETITION_ID]);
  const entries = result.rows.map(publicEntry);
  let winner: MixEntry | null = null; let tied = false;
  if (Date.now() >= Date.parse(settings.announce_at)) {
    const leaders = await db.query<{entry_id:string; total:string}>(`SELECT v.entry_id,count(*)::text total FROM mix_votes v JOIN mix_entries e ON e.id=v.entry_id JOIN users u ON u.id=v.user_id WHERE v.competition_id=$1 AND v.invalidated_at IS NULL AND e.status='published' AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL GROUP BY v.entry_id ORDER BY count(*) DESC`,[COMPETITION_ID]);
    const top=leaders.rows.filter(r=>r.total===leaders.rows[0]?.total);
    tied=top.length>1;
    const chosen=top.find(r=>r.entry_id===settings.winner_entry_id) || (top.length===1?top[0]:null);
    if(chosen){winner=entries.find(e=>e.id===chosen.entry_id)||null;tied=false;}
  }
  const vote = user ? await db.query("SELECT entry_id FROM mix_votes WHERE competition_id=$1 AND user_id=$2 AND invalidated_at IS NULL",[COMPETITION_ID,user.id]) : null;
  const own = user ? await db.query("SELECT id FROM mix_entries WHERE competition_id=$1 AND user_id=$2",[COMPETITION_ID,user.id]) : null;
  return { entries, settings, submissionsOpen:submissionsAllowed(settings), votingOpen:votingAllowed(settings),winner,tied,currentVote:vote?.rows[0]?.entry_id||null,signedIn:!!user,verified:!!user?.emailVerified,email:user?.email||"",hasEntry:!!own?.rowCount };
}
export async function castMixVote(user: AuthUser, entryId: string) {
  if (!user.emailVerified) throw new Error("Verify your email before voting.");
  const db=await getPool().connect();
  try {
    await db.query("BEGIN");
    const settings=await competitionSettings(db,true);
    if(!votingAllowed(settings)) throw new Error("Voting is closed.");
    const entry=await db.query("SELECT id FROM mix_entries WHERE id=$1 AND competition_id=$2 AND status='published' FOR SHARE",[entryId,COMPETITION_ID]);
    if(!entry.rowCount) throw new Error("This entry is unavailable.");
    const r=await db.query(`INSERT INTO mix_votes(competition_id,user_id,entry_id) VALUES($1,$2,$3) ON CONFLICT(competition_id,user_id) DO UPDATE SET entry_id=excluded.entry_id,updated_at=now() WHERE mix_votes.invalidated_at IS NULL RETURNING entry_id`,[COMPETITION_ID,user.id,entryId]);
    if(!r.rowCount)throw new Error("Your vote is under review. Please contact us.");
    await db.query("COMMIT");
  }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
}
export async function audit(db: Pick<PoolClient,"query">, actor: string, action: string, entry: string|null, details: Record<string,unknown>) {
  await db.query("INSERT INTO mix_admin_audit(id,actor_id,action,entry_id,details) VALUES($1,$2,$3,$4,$5)",[randomUUID(),actor,action,entry,JSON.stringify(details)]);
}
