import {recoverTicketCheckout} from './ticket-checkout-recovery';
import {getPool} from './db';
import {getStripe} from './stripe';
// Inventory is released only after Stripe confirms expiry, never on a local timer alone.
export async function expireClosedTicketCheckouts(){
 const rows=(await getPool().query(`SELECT o.id,o.stripe_checkout_session_id FROM ticket_orders o JOIN events e ON e.id=o.event_id WHERE o.status='pending' AND (o.stripe_checkout_session_id IS NULL OR e.sales_open=false OR e.status<>'published' OR e.ends_at<=now() OR EXISTS(SELECT 1 FROM ticket_order_items i JOIN ticket_types tt ON tt.id=i.ticket_type_id WHERE i.order_id=o.id AND tt.sales_end_at<=now())) ORDER BY o.checkout_checked_at NULLS FIRST,o.created_at LIMIT 100`)).rows;
 if(!rows.length)return;
 const stripe=getStripe();
 let failures=0;
 for(const order of rows){
  try{
   await recoverTicketCheckout(getPool(),stripe,order.id,'reconcile');
  }catch(error){failures++;console.error('Checkout expiry requires review',order.id,error instanceof Error?error.name:'UnknownError');}
 }
 if(failures)throw new Error('Checkout reconciliation failed for '+failures+' orders');
}
