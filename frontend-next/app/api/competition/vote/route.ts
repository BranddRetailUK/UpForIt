import { NextRequest,NextResponse } from "next/server";
import { mixError,mixUser } from "../../../../lib/mix-request";
import { castMixVote } from "../../../../lib/mix-competition";
import { consumeRateLimit } from "../../../../lib/auth";
export async function POST(request:NextRequest){try{
 const user=await mixUser(request);
 if(!await consumeRateLimit(`mix-vote:${user.id}`,20,60))return NextResponse.json({error:'Too many changes. Please try later.'},{status:429});
 const body=await request.json();if(typeof body.entryId!=='string'||! /^[0-9a-f-]{36}$/i.test(body.entryId))throw new Error('This entry is unavailable.');
 await castMixVote(user,body.entryId);return NextResponse.json({entryId:body.entryId});
}catch(e){return mixError(e);}}
