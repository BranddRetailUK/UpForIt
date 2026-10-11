import { NextRequest } from "next/server";
import { resolveSoundCloud, soundCloudLink } from "../../../../lib/soundcloud";
import { getAdminForRequest } from "../../../../lib/admin-auth";
import { getPool } from "../../../../lib/db";
import { COMPETITION_ID } from "../../../../lib/mix-shared";
import { consumeRateLimit } from "../../../../lib/auth";
import { requestIp } from "../../../../lib/request";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let value: string;
  try { value = soundCloudLink(request.nextUrl.searchParams.get("url") || ""); }
  catch { return Response.json({ error: "Enter a public HTTPS SoundCloud track link." }, { status: 400 }); }
  try {
    const admin = await getAdminForRequest(request);
    const entry = await getPool().query("SELECT id FROM mix_entries WHERE competition_id=$1 AND source_url=$2 AND (status='published' OR $3)", [COMPETITION_ID,value,!!admin]);
    if (!entry.rowCount) return Response.json({error:"This mix is unavailable."},{status:404});
    if (!await consumeRateLimit(`mix-playback:${requestIp(request)}`,120,1)) return Response.json({ error: "Please wait a minute before trying again." }, { status: 429 });
    return Response.json(await resolveSoundCloud(value), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Unable to load this SoundCloud mix. Check it is public or listen on SoundCloud." }, { status: 502 }); }
}
