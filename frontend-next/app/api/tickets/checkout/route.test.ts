import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const deps=vi.hoisted(()=>({query:vi.fn(),create:vi.fn(),recover:vi.fn(),status:'paid'}));
vi.mock('../../../../lib/meta',()=>({metaEventId:()=>'',getMetaRequestContext:()=>({consent:false})}));
vi.mock('../../../../lib/auth',()=>({consumeRateLimit:async()=>true,getUserForSessionToken:async()=>({id:'user',emailVerified:true}),SESSION_COOKIE:'session'}));
vi.mock('../../../../lib/db',()=>({getPool:()=>({connect:async()=>({query:deps.query,release:()=>{}})})}));
vi.mock('../../../../lib/stripe',()=>({assertTicketingEnabled:()=>{},getStripe:()=>({checkout:{sessions:{create:deps.create}}})}));
vi.mock('../../../../lib/ticket-checkout-recovery',async original=>({...await original<typeof import('../../../../lib/ticket-checkout-recovery')>(),recoverTicketCheckout:deps.recover}));
import {createHash} from 'node:crypto';
import {POST} from './route';
const items=[{ticketTypeId:'f15e9ac1-6873-4b57-b6d4-5e9cf8e09216',quantity:1}];
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://example.com');deps.query.mockImplementation(async(sql:string)=>({rows:sql.includes('SELECT * FROM ticket_orders')?[{id:'order',request_hash:createHash('sha256').update(JSON.stringify(items)).digest('hex'),status:deps.status}]:[]}));});
it.each(['paid','expired','refunded','refund_review','failed'])('returns explicit %s terminal state without creating another payment',async status=>{
 deps.status=status;const r=await POST(new NextRequest('https://example.com/api/tickets/checkout',{method:'POST',headers:{origin:'https://example.com'},body:JSON.stringify({idempotencyKey:'a'.repeat(20),items})}));expect(r.status).toBe(409);expect(await r.json()).toMatchObject({code:'checkout_finished',orderId:'order',orderStatus:status,canStartNew:true});expect(deps.create).not.toHaveBeenCalled();expect(deps.recover).not.toHaveBeenCalled();
});
