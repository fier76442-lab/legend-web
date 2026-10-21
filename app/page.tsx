'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
export default function Home(){
 const [entered,setEntered]=useState(false);
 useEffect(()=>{ if(sessionStorage.getItem('legend-entered')==='yes') setEntered(true); },[]);
 function enter(){sessionStorage.setItem('legend-entered','yes');setEntered(true)}
 return <>
  {!entered && <div className="intro-door"><div className="intro-glow"/><img src="/logo.png" alt="Legend RolePlay" className="intro-logo"/><p className="intro-kicker">THE CITY IS WAITING</p><h1>LEGEND <span className="red">ROLEPLAY</span></h1><p className="intro-copy">Your story. Your legacy. Your city.</p><button className="btn btn-red enter-btn" onClick={enter}>ENTER THE CITY <span>↗</span></button><small>CLICK TO OPEN THE GATES</small></div>}
  <section className="hero"><div className="container">
   <div className="hero-pill"><span className="live-dot"/> YOUR NEXT CHAPTER STARTS HERE</div>
   <img className="hero-logo" src="/logo.png" alt="Legend RolePlay"/>
   <h1>LEGEND <span className="red">ROLEPLAY</span></h1>
   <p className="subtitle">Welcome to Legend RolePlay. Build your story, create your legacy and join the city.</p>
   <div className="actions"><a className="btn" href="https://discord.gg/zYQFXrNWDS" target="_blank" rel="noreferrer">Join Discord ↗</a><a className="btn btn-red" href="fivem://connect/80.75.212.180">Connect FiveM ↗</a><Link className="btn btn-red" href="/application/whitelist">Apply for Whitelist ↗</Link></div>
   <div className="home-links"><Link href="/rules">Explore the rules</Link><span>✦</span><Link href="/staff">Meet the staff</Link><span>✦</span><Link href="/shop">Visit the shop</Link></div>
  </div></section>
  <section className="section"><div className="container"><h2 className="title">ENTER YOUR <span className="red">LEGACY</span></h2><p className="lead">Everything you need to get started in the city.</p><div className="grid">
   {[['Whitelist','Start your journey and apply to join the city.','/application/whitelist'],['The City Rules','Learn the rules that keep our roleplay immersive.','/rules'],['Shop','Discover vehicles and exclusive items.','/shop'],['Our Community','Meet the staff and content creators.','/staff'],['Support Tickets','Contact staff through a ticket.','/tickets'],['Streamers','Discover creators from our community.','/streamers'],['Gangs','Meet the crews shaping the city.','/gangs']].map(([t,d,l])=><Link href={l} className="card feature-card" key={t}><span className="feature-icon">✦</span><h3>{t}</h3><p>{d}</p><span className="feature-arrow">EXPLORE ↗</span></Link>)}
  </div></div></section>
 </>
}
