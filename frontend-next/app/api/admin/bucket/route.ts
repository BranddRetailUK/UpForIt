import { NextRequest, NextResponse } from 'next/server';
import { getAdminForRequest } from '../../../../lib/admin-auth';
import { adminBucketData, administerBucket } from '../../../../lib/bucket';
import { BucketError } from '../../../../lib/bucket-shared';
import { bucketErrorResponse } from '../../../../lib/bucket-response';
import { assertSameOrigin } from '../../../../lib/request';
import { csvCell } from '../../../../lib/mix-shared';
export const dynamic='force-dynamic';
export async function GET(request: NextRequest) {
  try {
    if (!await getAdminForRequest(request)) throw new BucketError('Admin access required.',403);
    const data=await adminBucketData();
    if(request.nextUrl.searchParams.get('export')==='csv'){
      const columns=['dj_name','email','status','eligible','checked_in','created_at'];
      return new Response([columns.join(','),...data.entries.map(row=>columns.map(key=>csvCell(row[key])).join(','))].join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="blackleys-bucket.csv"','Cache-Control':'private, no-store'}});
    }
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
  } catch(e) { return bucketErrorResponse(e); }
}
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user=await getAdminForRequest(request);
    if (!user) throw new BucketError('Admin access required.',403);
    const body=await request.json();
    if (!body || typeof body.action!=='string') throw new BucketError('Choose an action.');
    await administerBucket(user.id,body.action,body.entryId);
    return NextResponse.json(await adminBucketData(),{headers:{'Cache-Control':'private, no-store'}});
  } catch(e) { return bucketErrorResponse(e); }
}
