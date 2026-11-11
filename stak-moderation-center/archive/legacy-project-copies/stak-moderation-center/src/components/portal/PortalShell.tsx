"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type User = { username:string; globalName:string|null; avatar:string|null; stakRole:string; roleLabel:string };
const nav = [
  { title:"Workspace", items:[ ["Overview","/"], ["Team Hub","/team-hub"] ] },
  { title:"Team Management", items:[ ["Staff Records","/staff/records"], ["Absence Management","/staff/absences"], ["Warnings & History","/staff/warnings"], ["Staff Tickets","/staff/tickets"], ["Feedback Box","/feedback"] ] },
  { title:"Cases & Records", items:[ ["Player Records","/case/records/player-records"], ["Moderation Cases","/case/records/cases"], ["Ban & Sanction Records","/case/records/sanctions"] ] },
  { title:"Resources", items:[ ["Handbook","/resources/handbook"], ["Ticket Guide","/resources/ticket-guide"], ["Community Guidelines","/guidelines"] ] },
];
export default function PortalShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname(); const [user,setUser]=useState<User|null>(null); const [loaded,setLoaded]=useState(false);
  useEffect(()=>{fetch("/api/auth/me").then(r=>r.json()).then(d=>setUser(d.user??null)).catch(()=>setUser(null)).finally(()=>setLoaded(true));},[]);
  const logout=async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.href="/";};
  return <div className="portal"><aside className="sidebar"><Link href="/" className="brand"><span className="brand-mark">S</span><span><strong>STAK</strong><small>MODERATION CENTER</small></span></Link><div className="side-scroll">{nav.map(group=><section className="nav-group" key={group.title}><p>{group.title}</p>{group.items.map(([label,href])=><Link key={href} href={href} className={`nav-link ${pathname===href || (href!=="/"&&pathname.startsWith(href+"/"))?"active":""}`}><span className="nav-dot"/>{label}</Link>)}</section>)}{user?.stakRole==="owner"&&<section className="nav-group"><p>Owner</p><Link className={`nav-link ${pathname==="/feedback/inbox"?"active":""}`} href="/feedback/inbox"><span className="nav-dot"/>Feedback Inbox</Link></section>}</div><div className="sidebar-foot"><span className="status-light"/> STAK Discord connected</div></aside><main className="main"><header className="topbar"><div className="mobile-brand">STAK <span>MODERATION CENTER</span></div><div className="topbar-right">{loaded&&user?<><div className="user-pill"><span className="user-avatar">{(user.globalName||user.username).slice(0,1).toUpperCase()}</span><span><b>{user.globalName||user.username}</b><small>{user.roleLabel}</small></span></div><button className="quiet-button" onClick={logout}>Log out</button></>:<a className="button button-small" href="/api/auth/login">Continue with Discord</a>}</div></header><div className="page-content">{!loaded?<div className="loading">Loading workspace…</div>:children}</div></main></div>;
}
