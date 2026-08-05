import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { getPool } from "./db";
import { createTicketQrToken } from "./security";

type TicketDocumentRow = {
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
      WHERE o.id = $1
      ORDER BY t.created_at, t.ticket_number`,
    [orderId]
  );
  return result.rows;
}

export async function buildTicketPdf(orderId: string) {
  const tickets = await getTicketDocumentRows(orderId);
  if (!tickets.length) throw new Error("No issued tickets found for this order");
  const document = await PDFDocument.create();
  document.setTitle(`${tickets[0].event_title} tickets — ${tickets[0].order_number}`);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  for (const ticket of tickets) {
    const page = document.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 0.94, 0.1) });
    page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, color: rgb(1, 1, 1), borderColor: rgb(0.05, 0.05, 0.05), borderWidth: 4 });
    page.drawText("UPFORIT", { x: 65, y: 748, size: 40, font: bold, color: rgb(0.04, 0.04, 0.04) });
    page.drawText(ticket.event_title, { x: 65, y: 700, size: 24, font: bold, color: rgb(0.95, 0.12, 0.48) });
    const eventDate = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full", timeStyle: "short", timeZone: ticket.timezone
    }).format(new Date(ticket.starts_at));
    page.drawText(eventDate, { x: 65, y: 666, size: 13, font: regular });
    page.drawText(ticket.venue_name, { x: 65, y: 644, size: 13, font: regular });
    page.drawText(ticket.ticket_type_name, { x: 65, y: 598, size: 21, font: bold });
    page.drawText(`Ticket holder: ${ticket.display_name}`, { x: 65, y: 567, size: 12, font: regular });
    page.drawText(`Ticket: ${ticket.ticket_number}`, { x: 65, y: 545, size: 12, font: regular });
    page.drawText(`Order: ${ticket.order_number}`, { x: 65, y: 523, size: 12, font: regular });

    const qrBuffer = await QRCode.toBuffer(createTicketQrToken(ticket.public_id), {
      type: "png", width: 700, margin: 2, errorCorrectionLevel: "M"
    });
    const qr = await document.embedPng(qrBuffer);
    page.drawImage(qr, { x: 157, y: 205, width: 280, height: 280 });
    page.drawText("Present this QR code at the entrance", { x: 178, y: 176, size: 12, font: bold });
    page.drawText("Each QR code admits one person and can only be checked in once.", { x: 119, y: 146, size: 10, font: regular });
  }
  return document.save();
}

