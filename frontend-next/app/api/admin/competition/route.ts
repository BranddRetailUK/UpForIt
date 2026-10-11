import { NextRequest, NextResponse } from "next/server";
import { getAdminForRequest } from "../../../../lib/admin-auth";
import { getPool } from "../../../../lib/db";
import { COMPETITION_ID, csvCell, MIX_GENRES, validMixEmail } from "../../../../lib/mix-shared";
import { audit, competitionSettings } from "../../../../lib/mix-competition";
import { mixOrigin } from "../../../../lib/mix-request";
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 if(!await getAdminForRequest(request))return NextResponse.json({error:'Admin access required.'},{status:403});
 const db=getPool();
 const entries=await db.query(`SELECT e.*,count(v.user_id) FILTER(WHERE v.invalidated_at IS NULL AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL)::int votes FROM mix_entries e LEFT JOIN mix_votes v ON v.entry_id=e.id LEFT JOIN users u ON u.id=v.user_id WHERE e.competition_id=$1 GROUP BY e.id ORDER BY votes DESC,e.created_at`,[COMPETITION_ID]);
 if(request.nextUrl.searchParams.get('export')==='csv'){
 const columns=['artist','title','genre','email','source','status','allow_download','votes','created_at'];
 return new Response([columns.join(','),...entries.rows.map(r=>columns.map(k=>csvCell(r[k])).join(','))].join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="mix-competition.csv"','Cache-Control':'private, no-store'}});
 }
 const votes=await db.query(`SELECT v.user_id,v.entry_id,v.created_at,v.updated_at,v.invalidated_at,v.invalidation_reason,u.email,u.disabled_at,u.email_verified_at FROM mix_votes v JOIN users u ON u.id=v.user_id WHERE v.competition_id=$1 ORDER BY v.updated_at DESC`,[COMPETITION_ID]);
 const log=await db.query("SELECT a.action,a.entry_id,a.details,a.created_at,u.display_name FROM mix_admin_audit a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100");
 return NextResponse.json({settings:await competitionSettings(),entries:entries.rows,votes:votes.rows,audit:log.rows},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:NextRequest){
 const user=await getAdminForRequest(request);if(!user)return NextResponse.json({error:'Admin access required.'},{status:403});
 const db=await getPool().connect();
 try{
 mixOrigin(request);const body=await request.json();await db.query('BEGIN');const settings=await competitionSettings(db,true);
 if(body.action==='settings'){
 const dates=[body.submissionsClose,body.votingClose,body.announceAt].map(v=>new Date(v));
 if(dates.some(d=>!Number.isFinite(d.getTime()))||dates[0]>dates[1]||dates[1]>dates[2])throw new Error('Dates must be valid: submissions close no later than voting, and announcement follows voting.');
 await db.query('UPDATE mix_competitions SET submissions_open=$2,voting_open=$3,submissions_close_at=$4,voting_close_at=$5,announce_at=$6,updated_at=now() WHERE id=$1',[COMPETITION_ID,body.submissionsOpen===true,body.votingOpen===true,...dates]);
 await audit(db,user.id,'settings',null,{...body});
 }else if(body.action==='entry'){
 const entry=(await db.query('SELECT * FROM mix_entries WHERE id=$1 AND competition_id=$2 FOR UPDATE',[body.id,COMPETITION_ID])).rows[0];if(!entry)throw new Error('Entry not found.');
 if(typeof body.artist!=='string'||!body.artist.trim()||body.artist.length>80||typeof body.title!=='string'||!body.title.trim()||body.title.length>120||!MIX_GENRES.includes(body.genre)||!validMixEmail(body.email)||!['published','hidden'].includes(body.status))throw new Error('Enter valid entry details.');
 await db.query('UPDATE mix_entries SET artist=$2,title=$3,genre=$4,email=$5,status=$6,allow_download=$7,updated_at=now() WHERE id=$1',[body.id,body.artist.trim(),body.title.trim(),body.genre,body.email.trim().toLowerCase(),body.status,entry.source==='Upload'&&body.allowDownload===true]);
 await audit(db,user.id,'entry',body.id,{before:{artist:entry.artist,title:entry.title,genre:entry.genre,email:entry.email,status:entry.status,allowDownload:entry.allow_download},after:body});
 }else if(body.action==='vote'){
 if(typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>500)throw new Error('Enter a reason for this vote change.');
 const r=await db.query('UPDATE mix_votes SET invalidated_at=CASE WHEN $3 THEN now() ELSE NULL END,invalidation_reason=$4 WHERE competition_id=$1 AND user_id=$2 RETURNING entry_id',[COMPETITION_ID,body.userId,body.invalidate===true,body.reason.trim()]);if(!r.rowCount)throw new Error('Vote not found.');
 await audit(db,user.id,body.invalidate?'invalidate_vote':'restore_vote',r.rows[0].entry_id,{userId:body.userId,reason:body.reason});
 }else if(body.action==='winner'){
 if(Date.now()<Date.parse(settings.voting_close_at))throw new Error('Voting must close before confirming a winner.');
 const top=await db.query(`SELECT e.id,count(v.user_id) FILTER(WHERE v.invalidated_at IS NULL AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL)::int votes FROM mix_entries e LEFT JOIN mix_votes v ON v.entry_id=e.id LEFT JOIN users u ON u.id=v.user_id WHERE e.competition_id=$1 AND e.status='published' GROUP BY e.id ORDER BY votes DESC`,[COMPETITION_ID]);
 if(!top.rows.some(r=>r.id===body.id&&r.votes>0&&r.votes===top.rows[0]?.votes))throw new Error('Choose an entry with the highest valid vote count.');
 await db.query('UPDATE mix_competitions SET winner_entry_id=$2 WHERE id=$1',[COMPETITION_ID,body.id]);await audit(db,user.id,'confirm_winner',body.id,{});
 }else throw new Error('Unknown action.');
 await db.query('COMMIT');return NextResponse.json({ok:true});
 }catch(e){await db.query('ROLLBACK');return NextResponse.json({error:e instanceof Error?e.message:'Could not save changes.'},{status:400});}finally{db.release();}
}
