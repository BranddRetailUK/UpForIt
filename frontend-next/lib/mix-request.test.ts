import {afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {mixOrigin} from './mix-request';
afterEach(()=>vi.unstubAllEnvs());
describe('competition origin behind a reverse proxy',()=>{
 it('uses the configured public origin when the internal URL uses localhost',()=>{
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://www.upforitevents.co.uk');
 expect(()=>mixOrigin(new NextRequest('http://localhost:8080/api/competition/vote',{headers:{origin:'https://www.upforitevents.co.uk'}}))).not.toThrow();
 });
 it('rejects absent, cross-site and insecure origins',()=>{
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://www.upforitevents.co.uk');
 for(const origin of ['', 'https://evil.test','http://www.upforitevents.co.uk'])expect(()=>mixOrigin(new NextRequest('http://localhost:8080/api/competition/vote',{headers:origin?{origin}:{}}))).toThrow();
 });
 it('supports the configured local preview origin',()=>{
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','http://localhost:3010');
 expect(()=>mixOrigin(new NextRequest('http://localhost:3010/api/competition/vote',{headers:{origin:'http://localhost:3010'}}))).not.toThrow();
 });
});
