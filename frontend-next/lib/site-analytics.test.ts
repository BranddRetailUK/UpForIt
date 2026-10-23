import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { trackingPath } from './site-analytics';
const query=vi.fn(), limit=vi.fn();
vi.mock('./db',()=>({getPool:()=>({query})}));
vi.mock('./auth',()=>({consumeRateLimit:(...args:unknown[])=>limit(...args)}));
import { POST } from '../app/api/analytics/hit/route';
const id='bc2abbc0-f0f4-4454-9ca5-cf11484e3802';
function request(overrides:Record<string,string>={},body:unknown={id,path:'/events?private=secret'}){
 return new NextRequest('http://localhost:3000/api/analytics/hit',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000','user-agent':'Mozilla/5.0','content-type':'application/json',cookie:'upforit_meta_consent=granted',...overrides},body:JSON.stringify(body)});
}
beforeEach(()=>{query.mockReset().mockResolvedValue({});limit.mockReset().mockResolvedValue(true);});
describe('direct page analytics',()=>{
 it('strips query strings and rejects private/internal paths',()=>{
  expect(trackingPath('/events/?token=private')).toBe('/events');
  for(const path of ['/account/tickets','/admin','/api/test','//other.test','/scan','/bad path'])expect(trackingPath(path)).toBeNull();
 });
 it('requires consent and same origin and excludes bots and prefetch',async()=>{
  for(const headers of ([{cookie:''},{'user-agent':'Googlebot'},{purpose:'prefetch'},{'next-router-prefetch':'1'}] as Record<string,string>[]))expect((await POST(request(headers))).status).toBe(204);
  expect((await POST(request({origin:'https://evil.example'}))).status).toBe(403);
  expect(query).not.toHaveBeenCalled();
 });
 it('records a sanitised hit with idempotency and secure session cookies',async()=>{
  const response=await POST(request());expect(response.status).toBe(204);
  expect(query.mock.calls[0][0]).toContain('ON CONFLICT(id) DO NOTHING');
  expect(query.mock.calls[0][1][3]).toBe('/events');
  expect(response.cookies.get('upforit_analytics_session')?.value).toMatch(/^[a-f0-9-]{36}$/);
  expect(response.headers.get('set-cookie')).toContain('Max-Age=60');
 });
 it('reuses browser/session IDs and rejects invalid data and rate-limited clients',async()=>{
  await POST(request({cookie:`upforit_meta_consent=granted; upforit_analytics_visitor=${id}; upforit_analytics_session=${id}`}));
  expect(query.mock.calls[0][1]).toEqual([id,id,id,'/events']);
  expect((await POST(request({},null))).status).toBe(400);
  expect((await POST(request({},{id,path:'/account'}))).status).toBe(400);
  limit.mockResolvedValue(false);expect((await POST(request())).status).toBe(429);
 });
});
