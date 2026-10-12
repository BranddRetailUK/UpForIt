import {createHash,createCipheriv,randomBytes} from 'node:crypto';
export const hash=v=>createHash('sha256').update(v).digest('hex');
export const cookieName='upforit_admin_session';
export function sessionToken(req){const part=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));const token=part?.slice(cookieName.length+1);return token&&/^[A-Za-z0-9_-]{43}$/.test(token)?token:null;}
export function sameOrigin(req,origin){return req.headers.origin===origin&&(!req.headers['sec-fetch-site']||['same-origin','none'].includes(req.headers['sec-fetch-site']));}
export function sessionCookie(token,maxAge,production){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production?'; Secure':''}`;}
export function encryptJson(value){const secret=process.env.EMAIL_JOB_ENCRYPTION_KEY;if(!secret)throw new Error('Email encryption key unavailable');const iv=randomBytes(12),key=createHash('sha256').update(secret).digest(),cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.');}
export function csvCell(value){return '"'+String(value??'').replace(/^[=+@\-\t\r]/,c=>"'"+c).replaceAll('"','""')+'"';}
export function httpError(status,message){return Object.assign(new Error(message),{status});}
export const genres=['Dubstep','Grime','UKG','Garage','House','Multi-genre','Other'];
export function validateEntry(b){if(typeof b.artist!=='string'||!b.artist.trim()||b.artist.length>80||typeof b.title!=='string'||!b.title.trim()||b.title.length>120||!genres.includes(b.genre)||typeof b.email!=='string'||b.email.length>254||!/^\S+@\S+\.\S+$/.test(b.email)||!['published','hidden'].includes(b.status)||typeof b.reviewed!=='boolean'||typeof b.allow_download!=='boolean')throw httpError(400,'Enter valid entry details.');}
export function validateSettings(b){const dates=[b.close,b.voteClose,b.announce].map(v=>new Date(v));if(dates.some(d=>!Number.isFinite(d.getTime()))||dates[0]>dates[1]||dates[1]>dates[2]||typeof b.submissions!=='boolean'||typeof b.voting!=='boolean')throw httpError(400,'Submissions must close before voting ends; announcement must follow voting.');return dates;}
