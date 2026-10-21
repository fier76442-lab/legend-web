'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type DiscordProfile = { id: string; username: string; displayName: string; avatar: string | null };
export default function Navbar(){
 const [user,setUser]=useState<DiscordProfile|null>(null);
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>{
  let active=true;
  fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.ok?r.json():null)
   .then(data=>{if(active)setUser(data?.user||null)})
   .catch(()=>{if(active)setUser(null)})
   .finally(()=>{if(active)setLoaded(true)});
  return ()=>{active=false};
 },[]);
 useEffect(()=>{document.documentElement.dataset.theme='light';},[]);
 return <header className="site-header"><div className="nav-topline"><Link className="brand" href="/"><img src="/logo.png" alt="Legend Role Play"/><span>LEGEND ROLE PLAY</span></Link><div className="nav-tools">{loaded && (user ? <div className="discord-profile" title={user.username}><img src={user.avatar || '/discord-default-avatar.png'} alt="Discord avatar" onError={(e)=>{e.currentTarget.src='https://cdn.discordapp.com/embed/avatars/0.png'}}/><span>{user.displayName || user.username}</span><a href="/api/auth/logout" className="discord-logout">Logout</a></div> : <a className="btn btn-red discord-login" href="/api/auth/discord">Login with Discord</a>)}</div></div>
 <nav className="navlinks"  aria-label="Main navigation"><Link href="/">Home</Link><Link href="/shop">Shop</Link><Link href="/galerie">Galerie</Link><Link href="/application">Application</Link><Link href="/application/gang">Gang Application</Link><Link href="/tickets">Tickets</Link><Link href="/rules">Rules</Link><Link href="/staff">Staff</Link><Link href="/streamers">Streamers</Link><Link href="/gangs">Gangs</Link><Link href="/admin">Staff Panel</Link></nav></header>
}
