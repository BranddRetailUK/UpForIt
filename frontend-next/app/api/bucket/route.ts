import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit, getUserForSessionToken, SESSION_COOKIE } from '../../../lib/auth';
import { bucketStatus, enterBucket } from '../../../lib/bucket';
import { BucketError, validateBucketEntry } from '../../../lib/bucket-shared';
import { bucketErrorResponse } from '../../../lib/bucket-response';
import { assertSameOrigin } from '../../../lib/request';
import { getMetaRequestContext } from '../../../lib/meta';
export const dynamic='force-dynamic';
export async function GET(request: NextRequest) {
  try { return NextResponse.json(await bucketStatus(await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value)),{headers:{'Cache-Control':'private, no-store'}}); }
  catch(e) { return bucketErrorResponse(e); }
}
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user=await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) throw new BucketError('Sign in to enter the bucket.',401);
    if (!await consumeRateLimit(`bucket:${user.id}`,15,15)) throw new BucketError('Too many attempts. Please try again later.',429);
    const body=await request.json();
    const details=validateBucketEntry(body);
    return NextResponse.json(await enterBucket(user,details,getMetaRequestContext(request,body.meta)),{headers:{'Cache-Control':'private, no-store'}});
  } catch(e) { return bucketErrorResponse(e); }
}
