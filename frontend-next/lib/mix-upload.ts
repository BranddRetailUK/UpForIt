import { createHash, randomUUID } from "node:crypto";
import { getPool } from "./db";
export const MAX_MIX_BYTES = 200 * 1024 * 1024;
function config() {
 const cloud=process.env.CLOUDINARY_CLOUD_NAME, key=process.env.CLOUDINARY_API_KEY, secret=process.env.CLOUDINARY_API_SECRET;
 if(!cloud||!key||!secret)throw new Error("Audio uploads are temporarily unavailable.");
 return {cloud,key,secret};
}
export async function prepareMixUpload(userId:string, filename:unknown, size:unknown){
 if(typeof filename!=="string"||filename.length>200||!/^.+\.(mp3|wav|m4a)$/i.test(filename)||typeof size!=="number"||!Number.isSafeInteger(size)||size<=0||size>MAX_MIX_BYTES)throw new Error("Choose an MP3, WAV or M4A file up to 200 MB.");
 const {cloud,key,secret}=config();const id=randomUUID();const publicId=`UPFORIT/competition/${id}`;
 const timestamp=String(Math.floor(Date.now()/1000));
 const params={allowed_formats:"mp3,wav,m4a",overwrite:"false",public_id:publicId,timestamp};
 const signature=createHash("sha1").update(Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("&")+secret).digest("hex");
 await getPool().query("INSERT INTO mix_uploads(id,user_id,public_id,original_filename,expected_bytes) VALUES($1,$2,$3,$4,$5)",[id,userId,publicId,filename.split(/[\\/]/).pop(),size]);
 return {id,url:`https://api.cloudinary.com/v1_1/${cloud}/video/upload`,params:{...params,signature,api_key:key}};
}
export async function verifyMixUpload(id:string,userId:string){
 const row=(await getPool().query("SELECT * FROM mix_uploads WHERE id=$1 AND user_id=$2 AND consumed_at IS NULL AND created_at>now()-interval '2 hours'",[id,userId])).rows[0];
 if(!row)throw new Error("This upload expired. Please choose your file again.");
 const {cloud,key,secret}=config();
 const response=await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/video/upload/${encodeURIComponent(row.public_id)}?media_metadata=true`,{headers:{Authorization:`Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`},cache:"no-store",signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error("Upload has not finished. Please try again.");
 const asset=await response.json();
 if(asset.public_id!==row.public_id||asset.resource_type!=="video"||!['mp3','wav','m4a'].includes(asset.format)||asset.bytes!==Number(row.expected_bytes)||asset.bytes>MAX_MIX_BYTES||!asset.duration||asset.width>0||asset.height>0)throw new Error("Upload must contain a valid audio file only.");
 const base=`https://res.cloudinary.com/${cloud}/video/upload`;
 return {row,audio:`${base}/v${asset.version}/${row.public_id}.${asset.format}`,waveform:`${base}/fl_waveform,co_white,b_transparent,w_900,h_140/v${asset.version}/${row.public_id}.png`,duration:asset.duration};
}
