// Exercises only the isolated localhost DB. Never point this at production.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { getPool } from '../lib/db';
import { createSession } from '../lib/auth';
const main=async()=>{
if(!process.env.DATABASE_URL?.includes('127.0.0.1:55439'))throw new Error('Requires isolated local test database');
const db=getPool();const origin='http://localhost:3010';const ids=[randomUUID(),randomUUID(),randomUUID()];
const original=(await db.query("SELECT * FROM mix_competitions WHERE id='nye-2026'")).rows[0];
const tokens:string[]=[];let uploadAsset:string|undefined;
async function api(path:string,body?:unknown,who=0){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(tokens[who]?{Cookie:`upforit_session=${tokens[who]}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
try{
 for(let i=0;i<3;i++){await db.query("INSERT INTO users(id,email,display_name,password_hash,role,email_verified_at) VALUES($1,$2,$3,'unused',$4,$5)",[ids[i],`mix-test-${ids[i]}@example.com`,'Integration DJ',i===0?'admin':'customer',i===2?null:new Date()]);tokens.push((await createSession(ids[i])).token);}
 assert.equal((await api('/api/competition/vote',{entryId:randomUUID()},2)).status,403);
 assert.equal((await api('/api/admin/competition',undefined,1)).status,403);
 // Upload a generated audio fixture, then verify original bytes can be downloaded.
 const wav=Buffer.alloc(24*1024*1024+44);wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 const pre=await api('/api/competition/upload',{filename:'test-original.wav',size:wav.length});assert.equal(pre.status,200,JSON.stringify(pre.data));uploadAsset=pre.data.params.public_id;
 for(let start=0;start<wav.length;start+=6*1024*1024){const end=Math.min(start+6*1024*1024,wav.length);const f=new FormData();Object.entries(pre.data.params).forEach(([k,v])=>f.append(k,String(v)));f.append('file',new Blob([wav.subarray(start,end)],{type:'audio/wav'}),'test-original.wav');const upload=await fetch(pre.data.url,{method:'POST',headers:{'X-Unique-Upload-Id':pre.data.id,'Content-Range':`bytes ${start}-${end-1}/${wav.length}`},body:f});assert.equal(upload.status,200,'Cloudinary chunk upload');await upload.json();}
 const a=await api('/api/competition/entries',{artist:'Integration DJ',title:'Original test audio',genre:'House',email:'dj@example.com',source:'Upload',uploadId:pre.data.id,allowDownload:true});assert.equal(a.status,201,JSON.stringify(a.data));const first=a.data.entry.id;const wave=await fetch(a.data.entry.waveform);assert.equal(wave.status,200,'Uploaded mix waveform');
 const second=randomUUID();await db.query("INSERT INTO mix_entries(id,competition_id,user_id,artist,title,genre,email,source,source_url) VALUES($1,'nye-2026',$2,'Second DJ','Second mix','UKG','second@example.com','Link','https://soundcloud.com/spektral_artist/spektral-diatribe-dnb-vol-1')",[second,ids[1]]);
 const downloaded=await fetch(origin+`/api/competition/download/${first}`);assert.equal(downloaded.status,200);assert.equal(createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex'),createHash('sha256').update(wav).digest('hex'));
 assert.equal((await api('/api/competition/vote',{entryId:first},1)).status,200);
 await Promise.all([api('/api/competition/vote',{entryId:first},1),api('/api/competition/vote',{entryId:second},1)]);
 assert.equal(Number((await db.query('SELECT count(*) FROM mix_votes WHERE user_id=$1',[ids[1]])).rows[0].count),1);
 const admin=await api('/api/admin/competition');assert.equal(admin.status,200);assert.equal(admin.data.entries.reduce((n:number,e:{votes:number})=>n+e.votes,0),1);
 await api('/api/admin/competition',{action:'entry',id:first,artist:'Integration DJ',title:'Original test audio',genre:'House',email:'dj@example.com',status:'hidden',allowDownload:false});
 assert.equal((await fetch(origin+`/api/competition/download/${first}`)).status,404);
 assert.equal((await api('/api/competition/vote',{entryId:first},1)).status,400);
 await api('/api/admin/competition',{action:'vote',userId:ids[1],invalidate:true,reason:'Test invalidation'});assert.equal((await api('/api/competition/vote',{entryId:second},1)).status,400);
 await api('/api/admin/competition',{action:'vote',userId:ids[1],invalidate:false,reason:'Test restoration'});
 await api('/api/competition/vote',{entryId:second},1);
 await db.query("UPDATE mix_competitions SET submissions_close_at=now()-interval '2 minutes',voting_close_at=now()-interval '1 minute',announce_at=now()-interval '1 minute' WHERE id='nye-2026'");
 assert.equal((await api('/api/competition/vote',{entryId:second},1)).status,400);
 assert.equal((await api('/api/competition/upload',{filename:'test.wav',size:12})).status,400);
 const publicData=await api('/api/competition');assert.equal(publicData.data.winner.id,second);assert.equal(publicData.data.entries.some((e:Record<string,unknown>)=>'email' in e||'votes' in e),false);
 console.log('PASS: 24 MB chunked upload, waveform, original-byte download, verified-only voting, concurrent vote uniqueness, admin access, hiding, invalidation/restoration, cutoff and winner announcement.');
}finally{
 await db.query("UPDATE mix_competitions SET winner_entry_id=NULL,submissions_close_at=$1,voting_close_at=$2,announce_at=$3 WHERE id='nye-2026'",[original.submissions_close_at,original.voting_close_at,original.announce_at]);
 await db.query('DELETE FROM mix_admin_audit WHERE actor_id=ANY($1::uuid[])',[ids]);await db.query('DELETE FROM mix_votes WHERE user_id=ANY($1::uuid[])',[ids]);await db.query('DELETE FROM mix_entries WHERE user_id=ANY($1::uuid[])',[ids]);await db.query('DELETE FROM mix_uploads WHERE user_id=ANY($1::uuid[])',[ids]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ids]);
 if(uploadAsset){const timestamp=String(Math.floor(Date.now()/1000));const params={public_id:uploadAsset,timestamp};const signature=createHash('sha1').update(`public_id=${uploadAsset}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest('hex');const r=await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/destroy`,{method:'POST',body:new URLSearchParams({...params,signature,api_key:process.env.CLOUDINARY_API_KEY!})});console.log('Test fixture cleanup:',r.status);}
 await db.end();
}
};main().catch(e=>{console.error(e.message);process.exitCode=1;});
