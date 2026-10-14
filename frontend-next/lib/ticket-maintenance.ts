import {getPool} from './db';
import {getStripe} from './stripe';
// Inventory is released only after Stripe confirms expiry, never on a local timer alone.
export async function expireClosedTicketCheckouts(){
 const rows=(await getPool().query(`SELECT o.id,o.stripe_checkout_session_id FROM ticket_orders o JOIN events e ON e.id=o.event_id WHERE o.status='pending' AND o.stripe_checkout_session_id IS NOT NULL AND (e.sales_open=false OR e.status<>'published' OR e.ends_at<=now() OR EXISTS(SELECT 1 FROM ticket_order_items i JOIN ticket_types tt ON tt.id=i.ticket_type_id WHERE i.order_id=o.id AND tt.sales_end_at<=now())) ORDER BY o.created_at LIMIT 100`)).rows;
 if(!rows.length)return;
 const stripe=getStripe();
 for(const order of rows){
  try{
   let session=await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
   if(session.status==='open')session=await stripe.checkout.sessions.expire(session.id);
   if(session.status==='expired')await getPool().query("UPDATE ticket_orders SET status='expired',updated_at=now() WHERE id=$1 AND status='pending'",[order.id]);
  }catch(error){console.error('Checkout expiry requires review',order.id,error instanceof Error?error.name:'UnknownError');}
 }
}
