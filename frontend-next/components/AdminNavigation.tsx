import Link from "next/link";
export default function AdminNavigation({active}:{active:'tickets'|'competition'}){return <nav className="admin-section-nav" aria-label="Admin sections"><Link href="/admin" aria-current={active==='tickets'?'page':undefined}>Tickets</Link><Link href="/admin/competition" aria-current={active==='competition'?'page':undefined}>Mix Competition</Link></nav>;}
