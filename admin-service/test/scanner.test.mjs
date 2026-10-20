import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {verifyTicketCode,scannerCookie,scannerToken} from '../scanner.mjs';
test('scanner verifies existing QR format, rotated keys and rejects tampering',()=>{
 const id=randomUUID(),key='old-secret',code=`v1.${id}.${createHmac('sha256',key).update(`v1.${id}`).digest('base64url')}`;
 assert.equal(verifyTicketCode(code,{TICKET_QR_SIGNING_SECRET:key}),id);
 assert.equal(verifyTicketCode(code,{TICKET_QR_SIGNING_SECRET:'new',TICKET_QR_PREVIOUS_SIGNING_SECRETS:key}),id);
 assert.equal(verifyTicketCode(code,{TICKET_QR_SIGNING_SECRET:'wrong-environment'}),null);
 assert.equal(verifyTicketCode(code+'.extra',{TICKET_QR_SIGNING_SECRET:key}),null);
 assert.equal(verifyTicketCode(code.replace(id,randomUUID()),{TICKET_QR_SIGNING_SECRET:key}),null);
});
test('scanner access uses a strict host-only HttpOnly cookie',()=>{
 const token='a'.repeat(43),cookie=scannerCookie(token,new Date('2027-01-01'),true);
 assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.match(cookie,/; Secure$/);assert.ok(!cookie.includes('Domain='));
 assert.equal(scannerToken({headers:{cookie}}),token);assert.equal(scannerToken({headers:{cookie:'upforit_scanner=invalid'}}),null);
});
