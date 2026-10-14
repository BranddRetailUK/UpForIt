import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '../../../../lib/db';
import {verifyEmailEventSignature,recordTicketEmailEvents} from '../../../../lib/ticket-email-events';
export async function POST(request:NextRequest){
 const key=process.env.SENDGRID_TICKET_EVENT_PUBLIC_KEY;
 if(!key)return new NextResponse('Not configured',{status:503});
 const body=await request.text();
 if(body.length>1048576)return new NextResponse('Too large',{status:413});
 if(!verifyEmailEventSignature(body,request.headers.get('x-twilio-email-event-webhook-timestamp')||'',request.headers.get('x-twilio-email-event-webhook-signature')||'',key))return new NextResponse('Invalid signature',{status:401});
 let events;try{events=JSON.parse(body);}catch{return new NextResponse('Invalid JSON',{status:400});}
 if(!Array.isArray(events)||events.length>1000||events.some(e=>!e||typeof e!=='object'))return new NextResponse('Invalid events',{status:400});
 const db=await getPool().connect();
 try{await db.query('BEGIN');await recordTicketEmailEvents(db,events);await db.query('COMMIT');return NextResponse.json({ok:true});}catch{await db.query('ROLLBACK');return new NextResponse('Retry later',{status:500});}finally{db.release();}
}
