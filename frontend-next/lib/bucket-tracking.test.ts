import { beforeEach, describe, expect, it, vi } from "vitest";
const { query, release, insertJob }=vi.hoisted(()=>({query:vi.fn(),release:vi.fn(),insertJob:vi.fn()}));
vi.mock("./db",()=>({getPool:()=>({connect:async()=>({query,release})})}));
vi.mock("./event-visibility",()=>({publicTicketSalesOpen:()=>true}));
vi.mock("./meta-jobs",()=>({insertMetaConversionJob:insertJob}));
import {enterBucket} from "./bucket";
import type {AuthUser} from "./auth";
describe("bucket conversion transaction",()=>{
 const user={id:"user",email:"test@example.invalid",emailVerified:true} as AuthUser;
 const details={djName:"DJ",fullName:"Test",phone:null,attendance:true} as const;
 let existing=false;
 beforeEach(()=>{
  vi.clearAllMocks();existing=false;process.env.TICKETING_ENABLED="true";
  query.mockImplementation(async(sql:string)=>{
   if(sql.includes("FROM events"))return {rows:[{id:"event",status:"published",entry_open:true}]};
   if(sql.includes("SELECT dj_name,status"))return {rows:existing?[{dj_name:"DJ",status:"entered"}]:[]};
   if(sql.includes("SELECT t.id"))return {rows:[{id:"ticket"}]};
   return {rows:[]};
  });
 });
 it("queues one registration in the entry transaction after consent",async()=>{
  const result=await enterBucket(user,details,{consent:true});
  expect(insertJob).toHaveBeenCalledOnce();
  expect(insertJob.mock.calls[0][1].eventId).toBe(result.meta?.eventId);
  expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
 });
 it("does not queue or expose a pixel event without consent",async()=>{
  expect(await enterBucket(user,details,{consent:false})).not.toHaveProperty("meta");
  expect(insertJob).not.toHaveBeenCalled();
 });
 it("does not count duplicate submissions or existing entries again",async()=>{
  existing=true;
  expect(await enterBucket(user,details,{consent:true})).not.toHaveProperty("meta");
  expect(insertJob).not.toHaveBeenCalled();
 });
 it("rolls back both entry and event if the outbox cannot be persisted",async()=>{
  insertJob.mockRejectedValueOnce(new Error("outbox failed"));
  await expect(enterBucket(user,details,{consent:true})).rejects.toThrow("outbox failed");
  expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
 });
});
