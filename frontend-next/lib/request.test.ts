import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assertSameOrigin } from './request';
afterEach(()=>vi.unstubAllEnvs());
describe('request origin checks',()=>{
  const request=(origin:string,site='same-origin')=>new NextRequest('http://localhost:3000/api/bucket',{headers:{origin,host:'127.0.0.1:3000','sec-fetch-site':site}});
  it('accepts the actual local browser host during development',()=>{vi.stubEnv('NODE_ENV','development');expect(()=>assertSameOrigin(request('http://127.0.0.1:3000'))).not.toThrow();});
  it('rejects foreign origins in development',()=>{vi.stubEnv('NODE_ENV','development');expect(()=>assertSameOrigin(request('https://evil.invalid'))).toThrow();});
  it('uses only the configured canonical origin in production',()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://www.upforitevents.co.uk');expect(()=>assertSameOrigin(request('https://www.upforitevents.co.uk'))).not.toThrow();expect(()=>assertSameOrigin(request('http://127.0.0.1:3000'))).toThrow();});
  it('rejects cross-site requests even with a matching origin',()=>{vi.stubEnv('NODE_ENV','development');expect(()=>assertSameOrigin(request('http://127.0.0.1:3000','cross-site'))).toThrow();});
});
