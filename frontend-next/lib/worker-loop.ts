export async function runWorkerLane(options: {
  name: string; once: boolean; intervalMs: number;
  work: () => Promise<boolean | void>;
  success: () => Promise<void>;
  failure: (error: unknown) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  stopped?: () => boolean;
}) {
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve,ms)));
  let failures=0;
  while (!options.stopped?.()) {
    try {
      const worked=await options.work();
      await options.success();
      failures=0;
      if(options.once)return;
      if(!worked)await sleep(options.intervalMs);
    } catch(error) {
      failures++;
      console.error(`Worker lane ${options.name} failed`,error instanceof Error?error.name:'UnknownError');
      await options.failure(error).catch(()=>undefined);
      if(options.once)throw error;
      await sleep(Math.min(60000,1000*2**Math.min(failures,6)));
    }
  }
}
