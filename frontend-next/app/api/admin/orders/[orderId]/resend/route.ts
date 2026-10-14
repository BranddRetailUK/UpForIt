import { NextRequest, NextResponse } from 'next/server';
import { getUserForSessionToken, SESSION_COOKIE } from '../../../../../../lib/auth';
import { getPool } from '../../../../../../lib/db';
import { assertSameOrigin } from '../../../../../../lib/request';
import { resendTickets } from '../../../../../../lib/ticket-resend';
import { TicketRequestError, UUID_PATTERN } from '../../../../../../lib/ticket-checkout-input';
export async function POST(request: NextRequest,{params}:{params:Promise<{orderId:string}>}){
 try{
  assertSameOrigin(request);
  const user=await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
  const {orderId}=await params;
  if(!UUID_PATTERN.test(orderId))throw new TicketRequestError('Invalid order.');
  const db=await getPool().connect();
  try{await db.query('BEGIN');await resendTickets(db,orderId,user.id,user.role==='admin');await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  return NextResponse.json({ok:true});
 }catch(error){return NextResponse.json({error:error instanceof TicketRequestError?error.message:'Ticket resend failed.'},{status:error instanceof TicketRequestError?error.status:400});}
}
