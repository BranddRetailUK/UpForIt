import {createHash} from 'node:crypto';
// Public files only. Authenticated API responses retain no-store.
export function sendStatic(req,res,data,contentType){
 const etag='"'+createHash('sha256').update(data).digest('hex')+'"';
 res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.setHeader('ETag',etag);res.setHeader('Content-Type',contentType);
 if(String(req.headers['if-none-match']||'').split(',').some(v=>v.trim().replace(/^W\//,'')===etag||v.trim()==='*')){res.writeHead(304);return res.end();}
 res.setHeader('Content-Length',data.length);res.writeHead(200);res.end(req.method==='HEAD'?undefined:data);
}
