import {NextRequest,NextResponse} from 'next/server';
import {getAdminForRequest} from '../../../../../lib/admin-auth';
import {getPool} from '../../../../../lib/db';
import {UUID_PATTERN} from '../../../../../lib/ticket-checkout-input';
export async function GET(request:NextRequest){
 if(!await getAdminForRequest(request))return new NextResponse('Administrator access required',{status:403});
 const event=request.nextUrl.searchParams.get('event');if(event&&event!=='all'&&!UUID_PATTERN.test(event))return new NextResponse('Invalid event',{status:400});
 const rows=(await getPool().query(`SELECT o.order_number,e.title AS event,u.email,o.status,o.admissions_hold,o.total_minor AS gross_minor,o.refunded_minor,o.total_minor-o.refunded_minor AS net_minor,o.created_at,(SELECT COALESCE(sum(quantity),0) FROM ticket_order_items WHERE order_id=o.id AND unit_price_minor=0) AS free_admissions FROM ticket_orders o JOIN users u ON u.id=o.user_id JOIN events e ON e.id=o.event_id WHERE ($1::uuid IS NULL OR o.event_id=$1) ORDER BY o.created_at,o.id`,[event&&event!=='all'?event:null])).rows;
 const columns=['order_number','event','email','status','admissions_hold','gross_minor','refunded_minor','net_minor','free_admissions','created_at'];
 const cell=(value:unknown)=>{let text=value instanceof Date?value.toISOString():String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 return new NextResponse([columns.join(','),...rows.map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="ticket-orders.csv"','cache-control':'no-store'}});
}
