import { finishedCheckout, recoverTicketCheckout } from "../../../../lib/ticket-checkout-recovery";
import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { consumeRateLimit, getUserForSessionToken, SESSION_COOKIE } from '../../../../lib/auth';
import { getPool } from '../../../../lib/db';
import { metaEventId, getMetaRequestContext } from '../../../../lib/meta';
import { assertSameOrigin, requestIp } from '../../../../lib/request';
import { encryptJson } from '../../../../lib/security';
import { assertTicketingEnabled, getStripe } from '../../../../lib/stripe';
import { lockTicketTiersForCheckout } from '../../../../lib/ticket-tiers';
import { ticketPriceLines } from '../../../../lib/ticket-pricing';
import { parseTicketCheckout, TicketRequestError } from '../../../../lib/ticket-checkout-input';

type Existing = { id: string; request_hash: string; status: string; stripe_checkout_url: string | null; checkout_payload: Stripe.Checkout.SessionCreateParams | null; created_at: Date };
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    assertTicketingEnabled();
    const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return NextResponse.json({ error: 'Sign in to buy tickets.' }, { status: 401 });
    if (!user.emailVerified) return NextResponse.json({ error: 'Verify your email before buying tickets.', verificationRequired: true }, { status: 403 });
    if (!(await consumeRateLimit(`tickets:user:${user.id}`, 20, 10)) || !(await consumeRateLimit(`tickets:ip:${requestIp(request)}`, 60, 10))) throw new TicketRequestError('Too many checkout attempts. Please wait ten minutes.', 429);
    const raw = await request.text();
    if (raw.length > 8192) throw new TicketRequestError('Checkout request is too large.');
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new TicketRequestError('Invalid checkout request.'); }
    const body = parseTicketCheckout(parsed);
    const requestHash = createHash('sha256').update(JSON.stringify(body.items)).digest('hex');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error('Missing site URL');
    const stripe = getStripe(); // Validate configuration before any order is persisted.
    const client = await getPool().connect();
    let order: Existing;
    try {
      await client.query('BEGIN');
      // Serialize user checkout creation, including requests with different keys.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`ticket-checkout:${user.id}`]);
      const existing = await client.query<Existing>('SELECT * FROM ticket_orders WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE', [user.id, body.idempotencyKey]);
      if (existing.rows[0]) {
        order = existing.rows[0];
        if (order.request_hash !== requestHash) throw new TicketRequestError('This checkout reference belongs to a different selection.', 409);
        if (order.status !== 'pending') throw new TicketRequestError('This checkout has finished. View your order before choosing to buy more tickets.',409,finishedCheckout(order));
      } else {
        const pending = await client.query('SELECT id FROM ticket_orders WHERE user_id = $1 AND status = \'pending\'', [user.id]);
        if (pending.rowCount) throw new TicketRequestError('You already have an open checkout. Resume or cancel it from your account first.', 409);
        const { tiers } = await lockTicketTiersForCheckout(client, body.items);
        const lines = body.items.flatMap((item, index) => ticketPriceLines(tiers[index].event_slug, tiers[index].name, tiers[index].price_minor, item.quantity).map(line => ({ ...line, tier: tiers[index] })));
        const total = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
        if (tiers.some(tier => tier.currency !== 'gbp')) throw new TicketRequestError('These tickets are unavailable.', 409);
        const id = randomUUID();
        const meta = getMetaRequestContext(request, body.meta);
        const payload: Stripe.Checkout.SessionCreateParams = {
          expires_at: Math.max(Math.floor(Date.now()/1000)+31*60, Math.min(Math.floor(Date.now()/1000)+23*3600, ...tiers.map(t=>Math.floor(new Date(t.sales_deadline).getTime()/1000)))),
          mode: 'payment', payment_method_types: ['card'], customer_email: user.email,
          client_reference_id: id, metadata: { ticketOrderId: id },
          payment_intent_data: { metadata: { ticketOrderId: id } },
          line_items: lines.map(line => ({ quantity: line.quantity, price_data: { currency: 'gbp', unit_amount: line.unitPriceMinor, product_data: { name: `${line.tier.event_title} — ${line.name}` } } })),
          success_url: `${siteUrl}/tickets/confirmation?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/events/${tiers[0].event_slug}?checkout=cancelled`
        };
        await client.query(`INSERT INTO ticket_orders (id,user_id,event_id,status,currency,subtotal_minor,total_minor,idempotency_key,request_hash,reserved_until,checkout_payload,checkout_attempted_at,meta_consent_granted,meta_purchase_event_id,meta_context_encrypted)
          VALUES ($1,$2,$3,'pending','gbp',$4,$4,$5,$6,now()+interval '24 hours',$7::jsonb,NULL,$8,$9,$10)`,
          [id,user.id,tiers[0].event_id,total,body.idempotencyKey,requestHash,JSON.stringify(payload),meta.consent,meta.consent ? metaEventId('ticket_purchase',id) : null,meta.consent ? encryptJson({fbp:meta.fbp,fbc:meta.fbc,clientIp:meta.clientIp,clientUserAgent:meta.clientUserAgent}) : null]);
        for (const line of lines) await client.query(`INSERT INTO ticket_order_items (id,order_id,ticket_type_id,ticket_type_name,unit_price_minor,quantity,line_total_minor) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(),id,line.tier.id,line.name,line.unitPriceMinor,line.quantity,line.unitPriceMinor*line.quantity]);
        order = { id,request_hash:requestHash,status:'pending',stripe_checkout_url:null,checkout_payload:payload,created_at:new Date() };
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    const recovered=await recoverTicketCheckout(getPool(),stripe,order.id,'resume',user.id);
    return NextResponse.json(recovered,{status:'url' in recovered&&recovered.url?200:409});
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'TICKETING_DISABLED') return NextResponse.json({ error: 'Ticket sales are not open.' }, {status:409});
    if (message === 'Invalid request origin') return NextResponse.json({ error: message }, {status:403});
    if (error instanceof TicketRequestError) return NextResponse.json({error:message,...error.details},{status:error.status});
    if (/unavailable|Maximum|sold out/.test(message)) return NextResponse.json({error:message},{status:409});
    console.error('Ticket checkout requires retry', error instanceof Error ? error.name : 'UnknownError');
    // Never declare failure or release inventory after an uncertain Stripe result.
    return NextResponse.json({error:'Checkout could not be confirmed. Retry the same selection or check your account.'},{status:503});
  }
}
