import {NextRequest,NextResponse} from 'next/server';
import {getUserForSessionToken,SESSION_COOKIE,consumeRateLimit,createSingleUseToken} from '../../../../lib/auth';
import {assertSameOrigin} from '../../../../lib/request';
import {enqueueEmail} from '../../../../lib/email-jobs';
import {publicUrl,safeNextPath} from '../../../../lib/public-url';
export async function POST(request:NextRequest){
 try{
  assertSameOrigin(request);
  const user=await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
  if(user.emailVerified)return NextResponse.json({ok:true});
  if(!await consumeRateLimit(`verify-resend:${user.id}`,1,2))return NextResponse.json({error:'Please wait two minutes before requesting another email.'},{status:429});
  const body=await request.json();const token=await createSingleUseToken(user.id,'verify_email',1440);
  const url=publicUrl('/api/auth/verify',request.nextUrl.origin);url.searchParams.set('token',token);url.searchParams.set('next',safeNextPath(body.next)||'/account');
  await enqueueEmail('verify_email',{to:user.email,displayName:user.displayName,url:url.toString()},{userId:user.id});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Could not queue verification. Please try again.'},{status:400});}
}
