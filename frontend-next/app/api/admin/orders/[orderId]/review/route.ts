import { NextRequest, NextResponse } from 'next/server';
import { getAdminForRequest } from '../../../../../../lib/admin-auth';
import { getPool } from '../../../../../../lib/db';
import { assertSameOrigin } from '../../../../../../lib/request';
import { TicketRequestError, UUID_PATTERN } from '../../../../../../lib/ticket-checkout-input';
import { reviewAdmissions } from '../../../../../../lib/ticket-refund-review';
export async function POST(request:NextRequest,{params}:{params:Promise<{orderId:string}>}) {
  try {
    assertSameOrigin(request);
    const admin=await getAdminForRequest(request);
    if (!admin) return NextResponse.json({error:'Administrator access required.'},{status:403});
    const {orderId}=await params;
    const body=await request.json();
    if (!UUID_PATTERN.test(orderId) || !Array.isArray(body.keepIds) || body.keepIds.length>100 || body.keepIds.some((id:unknown)=>typeof id!=='string'||!UUID_PATTERN.test(id)) || !Number.isSafeInteger(body.refundedMinor)) throw new TicketRequestError('Invalid review.');
    const db=await getPool().connect();
    try { await db.query('BEGIN'); await reviewAdmissions(db,orderId,admin.id,body.keepIds,body.refundedMinor); await db.query('COMMIT'); }
    catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
    return NextResponse.json({ok:true});
  } catch(error){return NextResponse.json({error:error instanceof TicketRequestError?error.message:'Admission review failed.'},{status:error instanceof TicketRequestError?error.status:400});}
}
