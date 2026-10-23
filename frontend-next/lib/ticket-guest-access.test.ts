import {afterEach,expect,it,vi} from 'vitest';
import {canAccessGuestOrder,guestAccessHash,guestDownloadToken,validGuestDownloadToken} from './ticket-guest-access';
import {parseGuestBuyer} from './ticket-checkout-input';
afterEach(()=>vi.unstubAllEnvs());
it('requires valid name/email and normalizes whitespace and case',()=>{
 expect(parseGuestBuyer({name:'  Guest   Buyer ',email:' BUYER@example.com '})).toEqual({name:'Guest Buyer',email:'buyer@example.com'});
 for(const guest of [null,{}, {name:'G',email:'g@example.com'},{name:'Guest',email:'bad'},{name:'Guest',email:'a@b@c.com'},{name:'Guest',email:'x'.repeat(255)+'@example.com'}])expect(()=>parseGuestBuyer(guest)).toThrow();
});
it('guest bearer cannot authorize an account order or another guest',()=>{
 const token='a'.repeat(64),order={user_id:null,guest_access_hash:guestAccessHash(token)};
 expect(canAccessGuestOrder(order,token)).toBe(true);
 expect(canAccessGuestOrder(order,'b'.repeat(64))).toBe(false);
 expect(canAccessGuestOrder({...order,user_id:'user'},token)).toBe(false);
 expect(canAccessGuestOrder(order,undefined)).toBe(false);
});
it('download links are scoped to an order, signed and expire',()=>{
 vi.stubEnv('TICKET_QR_SIGNING_SECRET','local-test-only');
 const token=guestDownloadToken('order-one');
 expect(validGuestDownloadToken('order-one',token)).toBe(true);
 expect(validGuestDownloadToken('order-two',token)).toBe(false);
 expect(validGuestDownloadToken('order-one',token+'x')).toBe(false);
 vi.spyOn(Date,'now').mockReturnValue(Date.now()+366*86400*1000);
 expect(validGuestDownloadToken('order-one',token)).toBe(false);vi.restoreAllMocks();
});
