import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFFont, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { getPool } from "./db";
import { createTicketQrToken } from "./security";

export type TicketDocumentRow = {
  order_number: string;
  display_name: string;
  event_title: string;
  venue_name: string;
  starts_at: Date;
  timezone: string;
  ticket_number: string;
  public_id: string;
  ticket_type_name: string;
};

export async function getTicketDocumentRows(orderId: string) {
  const result = await getPool().query<TicketDocumentRow>(
    `SELECT o.order_number, u.display_name, e.title AS event_title, e.venue_name,
            e.starts_at, e.timezone, t.ticket_number, t.public_id, t.ticket_type_name
       FROM ticket_orders o
       JOIN users u ON u.id = o.user_id
       JOIN events e ON e.id = o.event_id
       JOIN tickets t ON t.order_id = o.id
      WHERE o.id = $1 AND o.status IN ('paid','refund_review') AND o.admissions_hold=false AND t.status <> 'void'
      ORDER BY t.created_at, t.ticket_number`,
    [orderId]
  );
  return result.rows;
}

export async function buildTicketPdf(orderId: string, ticketRows?: TicketDocumentRow[]) {
  const tickets = ticketRows ?? await getTicketDocumentRows(orderId);
  if (!tickets.length) throw new Error("No issued tickets found for this order");
  const document = await PDFDocument.create();
  document.setTitle(`${tickets[0].event_title} tickets — ${tickets[0].order_number}`);
  document.registerFontkit(fontkit);
  const regular = await document.embedFont(await readFile(path.join(process.cwd(), 'assets/fonts/NotoSans-Regular.ttf')), {subset:true});
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const banner = await document.embedPng(await readFile(path.join(process.cwd(), "public/brand/ticket-email-banner.png")));
  const supported = new Set(regular.getCharacterSet());
  const safe = (text: string) => [...text].every(char => supported.has(char.codePointAt(0)!)) ? text.replace(/[\r\n\t]/g,' ') : 'See account for full details';
  const fitted = (text: string, font: PDFFont, maximum: number) => {
    let value = safe(text);
    while (value.length > 1 && font.widthOfTextAtSize(value, 9) > 460) value = value.slice(0,-2) + '…';
    return {text:value, size:Math.min(maximum,460/Math.max(font.widthOfTextAtSize(value,1),1))};
  };

  for (const ticket of tickets) {
    const page = document.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const ink=rgb(.04,.04,.04), yellow=rgb(.95,1,0), white=rgb(1,1,1);
    page.drawRectangle({ x:0,y:0,width,height,color:white });
    page.drawImage(banner,{x:0,y:height-width/3,width,height:width/3});
    page.drawRectangle({x:0,y:582,width,height:62,color:yellow});
    const title=fitted(ticket.event_title.toUpperCase(),regular,30);
    page.drawText(title.text,{x:48,y:604,size:title.size,font:regular,color:ink});
    const eventDate=new Intl.DateTimeFormat("en-GB",{dateStyle:"full",timeStyle:"short",timeZone:ticket.timezone}).format(new Date(ticket.starts_at));
    for(const [text,y,size] of [[eventDate,554,12],[ticket.venue_name,531,17],[ticket.ticket_type_name,497,18]] as const){
      const line=fitted(text,regular,size);page.drawText(line.text,{x:48,y,size:line.size,font:regular,color:ink});
    }
    page.drawLine({start:{x:48,y:480},end:{x:547,y:480},thickness:2,color:ink});
    const holder=fitted(`Ticket holder: ${ticket.display_name}`,regular,12);
    page.drawText(holder.text,{x:48,y:458,size:holder.size,font:regular,color:ink});
    page.drawText(`TICKET ${ticket.ticket_number}`,{x:48,y:434,size:13,font:bold,color:ink});
    page.drawText(`ORDER ${ticket.order_number}`,{x:48,y:414,size:10,font:regular,color:ink});
    const qrBuffer = await QRCode.toBuffer(createTicketQrToken(ticket.public_id), {
      type: "png", width: 700, margin: 2, errorCorrectionLevel: "M"
    });
    const qr = await document.embedPng(qrBuffer);
    page.drawImage(qr, { x: 167.64, y: 130, width: 260, height: 260 });
    page.drawRectangle({x:0,y:0,width,height:105,color:ink});
    page.drawRectangle({x:0,y:100,width,height:5,color:yellow});
    page.drawText("ONE TICKET. ONE PERSON.",{x:48,y:68,size:22,font:bold,color:yellow});
    page.drawText("Show this QR code at the entrance. Each ticket scans once.",{x:48,y:43,size:11,font:regular,color:white});
    page.drawText(`upforitevents.co.uk  /  ${tickets.indexOf(ticket)+1} OF ${tickets.length}`,{x:48,y:22,size:10,font:bold,color:white});

  }
  return document.save();
}
