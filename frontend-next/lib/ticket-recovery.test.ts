import {afterEach,expect,it,vi} from 'vitest';
import {pollConfirmation} from './confirmation-polling';
import {runWorkerLane} from './worker-loop';
import {finishedCheckout} from './ticket-checkout-recovery';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
it('retries missing orders, server failures and network errors, then stops at paid',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:404})).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(Response.json({status:'pending'})).mockResolvedValueOnce(Response.json({status:'paid'}));
 const result=vi.fn(),waiting=vi.fn();const stop=pollConfirmation({sessionId:'cs_test',fetcher,result,waiting,signIn:vi.fn(),error:vi.fn()});await vi.runAllTimersAsync();expect(fetcher).toHaveBeenCalledTimes(5);expect(result).toHaveBeenLastCalledWith({status:'paid'});expect(waiting).not.toHaveBeenCalled();stop();
});
it('bounds retries and reports uncertainty instead of payment failure',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValue(new Response('',{status:404})),waiting=vi.fn(),error=vi.fn();pollConfirmation({sessionId:'cs_test',fetcher,result:vi.fn(),waiting,signIn:vi.fn(),error});await vi.runAllTimersAsync();expect(fetcher).toHaveBeenCalledTimes(12);expect(waiting).toHaveBeenCalledOnce();expect(error).not.toHaveBeenCalled();
});
it('handles session expiry without retrying or suggesting another payment',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValue(new Response('',{status:401})),signIn=vi.fn();pollConfirmation({sessionId:'cs_test',fetcher,result:vi.fn(),waiting:vi.fn(),signIn,error:vi.fn()});await vi.runAllTimersAsync();expect(fetcher).toHaveBeenCalledOnce();expect(signIn).toHaveBeenCalledOnce();
});
it('cancels an in-flight confirmation lookup on cleanup',async()=>{
 vi.useFakeTimers();let resolve!:(r:Response)=>void;const fetcher=vi.fn((_url,options)=>new Promise<Response>(r=>{resolve=r;})),result=vi.fn();const stop=pollConfirmation({sessionId:'cs',fetcher:fetcher as typeof fetch,result,waiting:vi.fn(),signIn:vi.fn(),error:vi.fn()});stop();expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);resolve(Response.json({status:'paid'}));await vi.runAllTimersAsync();expect(result).not.toHaveBeenCalled();
});
it('recovers a worker lane after claim/database failure and records success only after work',async()=>{
 const order:string[]=[];let calls=0;vi.spyOn(console,'error').mockImplementation(()=>{});
 await runWorkerLane({name:'maintenance',once:false,intervalMs:30000,stopped:()=>calls>=2,work:async()=>{calls++;order.push('work');if(calls===1)throw new Error('db');return false;},success:async()=>{order.push('healthy');},failure:async()=>{order.push('error');},sleep:async()=>{order.push('wait');}});
 expect(order).toEqual(['work','error','wait','work','healthy','wait']);
});
it('continues even when recording lane failure also fails',async()=>{
 let calls=0;vi.spyOn(console,'error').mockImplementation(()=>{});await runWorkerLane({name:'email',once:false,intervalMs:1,stopped:()=>calls>=2,work:async()=>{if(++calls===1)throw Error();return true;},success:async()=>{},failure:async()=>{throw Error();},sleep:async()=>{}});expect(calls).toBe(2);
});
it.each(['paid','expired','failed','refunded','refund_review'])('returns an explicit terminal checkout state for %s',status=>expect(finishedCheckout({id:'order',status})).toMatchObject({code:'checkout_finished',orderId:'order',orderStatus:status,canStartNew:true}));
