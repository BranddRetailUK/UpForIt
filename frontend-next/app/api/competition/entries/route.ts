import { randomUUID } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { mixError,mixUser } from "../../../../lib/mix-request";
import { competitionSettings,publicEntry } from "../../../../lib/mix-competition";
import { submissionsAllowed,validateMixDetails,cleanMixLink,COMPETITION_ID } from "../../../../lib/mix-shared";
import { verifyMixUpload } from "../../../../lib/mix-upload";
import { consumeRateLimit } from "../../../../lib/auth";
import { resolveSoundCloud } from "../../../../lib/soundcloud";
import { getPool } from "../../../../lib/db";
export async function POST(request:NextRequest){try{
 const user=await mixUser(request);
 if(!await consumeRateLimit(`mix-submit:${user.id}`,10,60))return NextResponse.json({error:'Too many attempts. Please try later.'},{status:429});
 const body=await request.json();const input=validateMixDetails(body);
 if(!submissionsAllowed(await competitionSettings()))throw new Error('Submissions are closed.');
 let sourceUrl:string|null=null;
 if(input.source==='Link'){const track=await resolveSoundCloud(cleanMixLink(body.url));if(!track.playable)throw new Error('Use a public SoundCloud mix that allows playback.');sourceUrl=track.permalink;}
 const upload=input.source==='Upload'?await verifyMixUpload(String(body.uploadId||''),user.id):null;
 const db=await getPool().connect();try{
 await db.query('BEGIN');const settings=await competitionSettings(db,true);
 if(!submissionsAllowed(settings))throw new Error('Submissions are closed.');
 if(upload){const claim=await db.query('UPDATE mix_uploads SET consumed_at=now() WHERE id=$1 AND consumed_at IS NULL RETURNING id',[upload.row.id]);if(!claim.rowCount)throw new Error('This upload has already been submitted.');}
 const result=await db.query(`INSERT INTO mix_entries(id,competition_id,user_id,artist,title,genre,email,source,source_url,upload_id,audio_url,original_filename,allow_download,duration_seconds,waveform_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,[randomUUID(),COMPETITION_ID,user.id,input.artist,input.title,input.genre,input.email,input.source,sourceUrl,upload?.row.id||null,upload?.audio||null,upload?.row.original_filename||null,!!upload&&body.allowDownload===true,upload?.duration||null,upload?.waveform||null]);
 await db.query('COMMIT');return NextResponse.json({entry:publicEntry(result.rows[0])},{status:201});
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}catch(e){return mixError(e);}}
