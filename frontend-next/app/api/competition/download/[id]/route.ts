import { getPool } from "../../../../../lib/db";
import { COMPETITION_ID } from "../../../../../lib/mix-shared";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return new Response('Not found',{status:404});
 const r=await getPool().query("SELECT audio_url,original_filename FROM mix_entries WHERE id=$1 AND competition_id=$2 AND status='published' AND source='Upload' AND allow_download=true",[id,COMPETITION_ID]);
 if(!r.rowCount)return new Response('Downloads are not enabled for this mix.',{status:404});
 // Only the disposition changes: no format/quality transformation of the original file.
 const filename=r.rows[0].original_filename.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120)||'mix';
 return new Response(null,{status:302,headers:{Location:r.rows[0].audio_url.replace('/upload/',`/upload/fl_attachment:${filename}/`),'Cache-Control':'no-store'}});
}
