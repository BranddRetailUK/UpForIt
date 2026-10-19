import type { Metadata } from 'next';
import { getCurrentUser } from '../../../../lib/auth';
import { bucketStatus } from '../../../../lib/bucket';
import type { BucketStatus } from '../../../../lib/bucket-shared';
import BucketPage from './BucketPage';
import './bucket.css';
export const dynamic='force-dynamic';
export const metadata: Metadata = {
  title: 'Blackley’s Bucket · NYE 2026',
  description: 'Your chance to play at UPFORIT NYE. Eight DJs. Fifteen minutes each. A live draw.',
  alternates: {canonical:'/events/nye-2026/blackleys-bucket'}
};
export default async function Page({searchParams}:{searchParams:Promise<{preview?:string}>}) {
  const preview=process.env.NODE_ENV==='development' && (await searchParams).preview==='1';
  let initial:BucketStatus={state:'unavailable'};
  let account: { fullName: string; email: string } | undefined;
  if(preview) { initial={state:'eligible'}; account={fullName:'Alex Taylor',email:'alex@example.com'}; }
  else try { const user=await getCurrentUser(); initial=await bucketStatus(user); if(user) account={fullName:user.displayName,email:user.email}; }
  catch { console.error('[bucket-page] Could not load account eligibility'); }
  return <BucketPage initial={initial} preview={preview} account={account}/>;
}
