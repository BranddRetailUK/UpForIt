import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "../../../lib/auth";
import AdminNavigation from "../../../components/AdminNavigation";
import AdminCompetition from "../../../components/AdminCompetition";
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Mix competition admin',robots:{index:false,follow:false}};
export default async function Page(){const user=await getCurrentUser();if(!user)redirect('/account/login?next=%2Fadmin%2Fcompetition');if(user.role!=='admin')redirect('/account');return <div className="admin-shell admin-dashboard section-wrap"><header className="admin-header"><div><h1>Mix competition</h1><p>Signed in as {user.email}</p></div></header><AdminNavigation active="competition"/><AdminCompetition/></div>;}
