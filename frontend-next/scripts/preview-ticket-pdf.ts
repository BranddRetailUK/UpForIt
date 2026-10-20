import {buildTicketPdf} from '../lib/ticket-document';
import {writeFile} from 'node:fs/promises';
async function main(){
process.env.TICKET_QR_SIGNING_SECRET='preview-only-not-valid-for-entry-123456789';
const pdf=await buildTicketPdf('preview',[{order_number:'PREVIEW ONLY',display_name:'Scott — design preview',event_title:'NYE 2026',venue_name:'McCarthys Sports Bar · Bletchley',starts_at:new Date('2026-12-31T17:00:00Z'),timezone:'Europe/London',ticket_number:'NOT VALID FOR ENTRY',public_id:'preview-only',ticket_type_name:'General admission'}]);
await writeFile('../output/pdf/UPFORIT-ticket-design-preview.pdf',pdf);
}main();
