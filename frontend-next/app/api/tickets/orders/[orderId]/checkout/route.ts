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
  const db=await getPool().connect();
  try{
   await db.query('BEGIN');
   const order=(await db.query('SELECT * FROM ticket_orders WHERE id=$1 AND user_id=$2 FOR UPDATE',[orderId,user.id])).rows[0];
   if(!order||order.status!=='pending')throw new TicketRequestError('Checkout is no longer pending. Refresh your account.',409);
   const stripe=getStripe();
   if(!order.stripe_checkout_session_id && (!order.checkout_payload||Date.now()-new Date(order.created_at).getTime()>23*3600000))throw new TicketRequestError('This checkout needs an administrator to reconcile it with Stripe before it can be released.',409);
   let session=order.stripe_checkout_session_id?await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id):await stripe.checkout.sessions.create(order.checkout_payload,{idempotencyKey:`upforit-ticket-order-${order.id}`});
   if(session.client_reference_id!==order.id||session.metadata?.ticketOrderId!==order.id)throw new Error('Checkout mismatch');
   if(action==='cancel'&&session.status==='open')session=await stripe.checkout.sessions.expire(session.id);
   await db.query(`UPDATE ticket_orders SET stripe_checkout_session_id=$2,stripe_checkout_url=$3,status=CASE WHEN $4='expired' THEN 'expired' ELSE status END,updated_at=now() WHERE id=$1`,[order.id,session.id,session.url,session.status]);
   await db.query('COMMIT');
   return NextResponse.json({url:action==='resume'&&session.status==='open'?session.url:null,message:session.status==='complete'?'Payment is being confirmed. Do not pay again.':session.status==='expired'?'Checkout cancelled. You can start a new order.':'Checkout ready.'});
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }catch(error){return NextResponse.json({error:error instanceof TicketRequestError?error.message:error instanceof Error&&error.message==='TICKETING_DISABLED'?'Ticket sales are not open.':'Unable to confirm checkout status. Please try again or contact support.'},{status:error instanceof TicketRequestError?error.status:409});}
}
