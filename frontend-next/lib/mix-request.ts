import { NextRequest, NextResponse } from "next/server";
import { getUserForSessionToken, SESSION_COOKIE } from "./auth";
export function mixOrigin(request:NextRequest){
 const origin=request.headers.get('origin');
 const publicOrigin=process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
 if(!origin||new URL(origin).origin!==new URL(publicOrigin).origin)throw new Error('Invalid request origin.');
}
export async function mixUser(request:NextRequest){
 mixOrigin(request);
 const user=await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
 if(!user)throw new Error('Sign in to continue.');
 if(!user.emailVerified)throw new Error('Verify your email to continue.');
 return user;
}
export function mixError(error:unknown){
 const e=error as {code?:string;message?:string};
 const message=e.code==='23505'?'You already have an entry, or that mix link has already been submitted.':e.message||'Unable to complete this request.';
 const safe=/^(Sign in|Verify your email|Voting is|Submissions are|This entry|Your vote|Enter |Choose |Use a |You already|This upload|Upload |Audio uploads|Invalid request)/.test(message);
 return NextResponse.json({error:safe?message:'Unable to complete this request. Please try again.'},{status:message.startsWith('Sign in')?401:message.startsWith('Verify')?403:400});
}
