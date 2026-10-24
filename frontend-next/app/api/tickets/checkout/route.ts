import { ATTRIBUTION_COOKIE, readOrderAttribution } from "../../../../lib/order-attribution";
import { finishedCheckout, recoverTicketCheckout } from "../../../../lib/ticket-checkout-recovery";
import { GUEST_COOKIE, guestAccessHash } from '../../../../lib/ticket-guest-access';
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
import { parseGuestBuyer, parseTicketCheckout, TicketRequestError } from '../../../../lib/ticket-checkout-input';

type Existing = { user_id: string | null; id: string; request_hash: string; status: string; stripe_checkout_url: string | null; checkout_payload: Stripe.Checkout.SessionCreateParams | null; created_at: Date };
export async function POST(request: NextRequest) {
  let responseGuestToken: string | undefined;
  // Preserve guest access even when Stripe fails after the order is committed.
  const json = (body: unknown, init?: Parameters<typeof NextResponse.json>[1]) => {
    const response = NextResponse.json(body, init);
    if (responseGuestToken) response.cookies.set(GUEST_COOKIE, responseGuestToken, {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:30*24*60*60});
    return response;
  };
  try {
    assertSameOrigin(request);
    assertTicketingEnabled();
    const user = await getUserForSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (user && !user.emailVerified) return json({ error: 'Verify your email before buying tickets.', verificationRequired: true }, { status: 403 });
    if ((user && !(await consumeRateLimit(`tickets:user:${user.id}`, 20, 10))) || !(await consumeRateLimit(`tickets:ip:${requestIp(request)}`, 60, 10))) throw new TicketRequestError('Too many checkout attempts. Please wait ten minutes.', 429);
    const raw = await request.text();
    if (raw.length > 8192) throw new TicketRequestError('Checkout request is too large.');
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new TicketRequestError('Invalid checkout request.'); }
    const body = parseTicketCheckout(parsed);
    const guest = user ? null : parseGuestBuyer(body.guest);
    const guestToken = request.cookies.get(GUEST_COOKIE)?.value || body.guestToken;
    const accessHash = guestAccessHash(guestToken);
    if (guest && !accessHash) throw new TicketRequestError('Please refresh the page and try guest checkout again.');
    if (accessHash && typeof guestToken === 'string') responseGuestToken = guestToken;
    if (guest && !(await consumeRateLimit(`tickets:guest:${guest.email}`, 10, 10))) throw new TicketRequestError('Too many checkout attempts. Please wait ten minutes.', 429);
    const requestHash = createHash('sha256').update(JSON.stringify(guest ? {items:body.items,guest} : body.items)).digest('hex');
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) throw new Error('Missing site URL');
    const stripe = getStripe(); // Validate configuration before any order is persisted.
    const client = await getPool().connect();
    let order: Existing;
    try {
      await client.query('BEGIN');
      // Lock both identities in a stable order across guest-to-account transitions.
      for (const buyerKey of [...new Set([user?.id, accessHash].filter((key): key is string => !!key))].sort()) {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`ticket-checkout:${buyerKey}`]);
      }
      const existing = await client.query<Existing>('SELECT * FROM ticket_orders WHERE ((user_id = $1) OR (user_id IS NULL AND guest_access_hash = $3)) AND idempotency_key = $2 FOR UPDATE', [user?.id ?? null, body.idempotencyKey, accessHash]);
      if (existing.rows[0]) {
        order = existing.rows[0];
        if (order.status !== 'pending') throw new TicketRequestError('This checkout has finished. View your order before choosing to buy more tickets.',409,finishedCheckout(order));
        if (!order.user_id && user) throw new TicketRequestError('You started this checkout as a guest. Resume or cancel it before starting another purchase.',409,{pendingOrderId:order.id});
        if (order.request_hash !== requestHash) throw new TicketRequestError('This checkout reference belongs to a different selection or buyer details. Resume or cancel the previous checkout first.', 409, !order.user_id ? {pendingOrderId:order.id} : {});
      } else {
        const pending = await client.query("SELECT id,user_id FROM ticket_orders WHERE ((user_id = $1) OR (user_id IS NULL AND guest_access_hash = $2)) AND status = 'pending'", [user?.id ?? null, accessHash]);
        if (pending.rowCount) throw new TicketRequestError(!pending.rows[0].user_id ? 'You already have an open guest checkout. Resume or cancel it below before starting another purchase.' : 'You already have an open checkout. Resume or cancel it from your account first.', 409, !pending.rows[0].user_id ? {pendingOrderId:pending.rows[0].id} : {});
        const { tiers } = await lockTicketTiersForCheckout(client, body.items);
        const lines = body.items.flatMap((item, index) => ticketPriceLines(tiers[index].event_slug, tiers[index].name, tiers[index].price_minor, item.quantity).map(line => ({ ...line, tier: tiers[index] })));
        const total = lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
        if (tiers.some(tier => tier.currency !== 'gbp')) throw new TicketRequestError('These tickets are unavailable.', 409);
        const id = randomUUID();
        const meta = getMetaRequestContext(request, body.meta);
        const payload: Stripe.Checkout.SessionCreateParams = {
          expires_at: Math.ceil(Date.now()/1000)+30*60+5,
          mode: 'payment', payment_method_types: ['card'], customer_email: user?.email ?? guest!.email,
          client_reference_id: id, metadata: { ticketOrderId: id },
          payment_intent_data: { metadata: { ticketOrderId: id } },
          line_items: lines.map(line => ({ quantity: line.quantity, price_data: { currency: 'gbp', unit_amount: line.unitPriceMinor, product_data: { name: `${line.tier.event_title} — ${line.name}` } } })),
          success_url: `${siteUrl}/tickets/confirmation?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/events/${tiers[0].event_slug}?checkout=cancelled`
        };
        await client.query(`INSERT INTO ticket_orders (id,user_id,event_id,status,currency,subtotal_minor,total_minor,idempotency_key,request_hash,reserved_until,checkout_payload,checkout_attempted_at,meta_consent_granted,meta_purchase_event_id,meta_context_encrypted,guest_name,guest_email,guest_access_hash,source_attribution)
          VALUES ($1,$2,$3,'pending','gbp',$4,$4,$5,$6,now()+interval '30 minutes',$7::jsonb,NULL,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [id,user?.id ?? null,tiers[0].event_id,total,body.idempotencyKey,requestHash,JSON.stringify(payload),meta.consent,meta.consent ? metaEventId('ticket_purchase',id) : null,meta.consent ? encryptJson({fbp:meta.fbp,fbc:meta.fbc,clientIp:meta.clientIp,clientUserAgent:meta.clientUserAgent}) : null,guest?.name ?? null,guest?.email ?? null,guest ? accessHash : null,JSON.stringify(readOrderAttribution(request.cookies.get(ATTRIBUTION_COOKIE)?.value,meta.consent))]);
        for (const line of lines) await client.query(`INSERT INTO ticket_order_items (id,order_id,ticket_type_id,ticket_type_name,unit_price_minor,quantity,line_total_minor) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(),id,line.tier.id,line.name,line.unitPriceMinor,line.quantity,line.unitPriceMinor*line.quantity]);
        order = { user_id:user?.id ?? null,id,request_hash:requestHash,status:'pending',stripe_checkout_url:null,checkout_payload:payload,created_at:new Date() };
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    const recovered=await recoverTicketCheckout(getPool(),stripe,order.id,'resume',user?.id);
    return json(recovered,{status:'url' in recovered&&recovered.url?200:409});
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'TICKETING_DISABLED') return json({ error: 'Ticket sales are not open.' }, {status:409});
    if (message === 'Invalid request origin') return json({ error: message }, {status:403});
    if (error instanceof TicketRequestError) return json({error:message,...error.details},{status:error.status});
    if (/unavailable|Maximum|sold out/.test(message)) return json({error:message},{status:409});
    console.error('Ticket checkout requires retry', error instanceof Error ? error.name : 'UnknownError');
    // Never declare failure or release inventory after an uncertain Stripe result.
    return json({error:'Checkout could not be confirmed. Retry the same selection, check your email or contact support. Do not pay again if payment was taken.'},{status:503});
  }
}
