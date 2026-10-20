import {recoverTicketCheckout} from "../../../../../../lib/ticket-checkout-recovery";
import {NextRequest,NextResponse} from 'next/server';
import {getUserForSessionToken,SESSION_COOKIE,consumeRateLimit} from '../../../../../../lib/auth';
import {getPool} from '../../../../../../lib/db';
import {assertSameOrigin} from '../../../../../../lib/request';
import {getStripe,assertTicketingEnabled} from '../../../../../../lib/stripe';
import {TicketRequestError,UUID_PATTERN} from '../../../../../../lib/ticket-checkout-input';
export async function POST(request:NextRequest,{params}:{params:Promise<{orderId:string}>}){
 try{
  assertSameOrigin(request);
  const user=await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
  if(!await consumeRateLimit(`checkout-recovery:${user.id}`,10,10))throw new TicketRequestError('Please wait before checking again.',429);
  const {orderId}=await params;const {action}=await request.json();
  if(!UUID_PATTERN.test(orderId)||!['resume','cancel'].includes(action))throw new TicketRequestError('Invalid request.');
  if(action==='resume')assertTicketingEnabled();
  return NextResponse.json(await recoverTicketCheckout(getPool(),getStripe(),orderId,action,user.id));
 }catch(error){return NextResponse.json({error:error instanceof TicketRequestError?error.message:error instanceof Error&&error.message==='TICKETING_DISABLED'?'Ticket sales are not open.':'Unable to confirm checkout status. Please try again or contact support.'},{status:error instanceof TicketRequestError?error.status:409});}
}
