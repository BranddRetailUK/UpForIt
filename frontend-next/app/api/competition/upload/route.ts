import { NextRequest,NextResponse } from "next/server";
import { mixError,mixUser } from "../../../../lib/mix-request";
import { competitionSettings } from "../../../../lib/mix-competition";
import { submissionsAllowed } from "../../../../lib/mix-shared";
import { prepareMixUpload } from "../../../../lib/mix-upload";
import { consumeRateLimit } from "../../../../lib/auth";
export async function POST(request:NextRequest){try{
 const user=await mixUser(request);
 if(!submissionsAllowed(await competitionSettings()))throw new Error('Submissions are closed.');
 if(!await consumeRateLimit(`mix-upload:${user.id}`,5,1440))return NextResponse.json({error:'Too many upload attempts. Please try again tomorrow.'},{status:429});
 const body=await request.json();return NextResponse.json(await prepareMixUpload(user.id,body.filename,body.size));
}catch(e){return mixError(e);}}
