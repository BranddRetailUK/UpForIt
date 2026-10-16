import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth';
import AdminNavigation from '../../../components/AdminNavigation';
import BucketAdmin from './BucketAdmin';
import './bucket-admin.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Blackley’s Bucket admin',robots:{index:false,follow:false}};
export default async function Page(){
  const user=await getCurrentUser();
  if(!user) redirect('/account/login?next=%2Fadmin%2Fbucket');
  if(user.role!=='admin') redirect('/account');
  return <div className="admin-shell admin-dashboard section-wrap"><header className="admin-header"><h1>Blackley’s Bucket</h1></header><AdminNavigation active="bucket"/><BucketAdmin/></div>;
}
