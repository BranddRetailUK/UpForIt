import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "../../../lib/auth";
import { competitionData } from "../../../lib/mix-competition";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 try{return NextResponse.json(await competitionData(await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value)),{headers:{'Cache-Control':'private, no-store'}});}
 catch{return NextResponse.json({error:'The competition is temporarily unavailable. Please try again.'},{status:503});}
}
