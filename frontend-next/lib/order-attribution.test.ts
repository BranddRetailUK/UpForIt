import {describe,it,expect} from 'vitest';
import {captureAttribution,readOrderAttribution,normalizeAttribution,ATTRIBUTION_MAX_AGE} from './order-attribution';
const now=Date.parse('2026-10-24T09:00:00Z');
const tagged=()=>captureAttribution('https://www.upforitevents.co.uk/events/nye-2026?utm_source=ig&utm_medium=paid_social&utm_campaign=nye-2026&utm_content=123&email=private@example.com&fbclid=secret','https://l.instagram.com/?private=secret',null,now)!;
describe('consent-aware ticket attribution',()=>{
 it('stores only allowed campaign fields, domain and public path',()=>{const a=tagged();expect(a.source).toBe('ig');expect(a.referrerHost).toBe('l.instagram.com');expect(a.landingPath).toBe('/events/nye-2026');expect(JSON.stringify(a)).not.toMatch(/secret|private|fbclid/);});
 it('requires current consent even with a saved cookie',()=>{const raw=encodeURIComponent(JSON.stringify(tagged()));expect(readOrderAttribution(raw,false,now)).toBeNull();expect(readOrderAttribution(raw,true,now)?.campaign).toBe('nye-2026');});
 it('preserves source through internal, direct and Stripe returns',()=>{const a=tagged();for(const ref of ['', 'https://upforitevents.co.uk/account','https://checkout.stripe.com/c/pay/private'])expect(captureAttribution('https://www.upforitevents.co.uk/events/nye-2026',ref,a,now)).toEqual(a);});
 it('updates source on a later tagged visit',()=>expect(captureAttribution('https://www.upforitevents.co.uk/?utm_source=newsletter&utm_medium=email','',tagged(),now)?.source).toBe('newsletter'));
 it('rejects stale, malformed and unsafe client data',()=>{expect(readOrderAttribution('%broken',true,now)).toBeNull();expect(normalizeAttribution(tagged(),now+(ATTRIBUTION_MAX_AGE+1)*1000)).toBeNull();expect(normalizeAttribution({...tagged(),source:'<script>'},now)).toBeNull();expect(normalizeAttribution({...tagged(),landingPath:'/account/reset/token'},now)).toBeNull();});
 it('does not call untagged social referrals paid adverts',()=>{const a=captureAttribution('https://www.upforitevents.co.uk/','https://l.facebook.com/link',null,now);expect(a?.source).toBe('facebook');expect(a?.medium).toBe('referral');expect(captureAttribution('https://www.upforitevents.co.uk/','',null,now)?.source).toBe('direct');});
});
