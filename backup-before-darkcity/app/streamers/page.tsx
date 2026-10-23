'use client';
import { useEffect, useState } from 'react';
type Streamer = { id: string; username: string; displayName: string; avatar: string };
export default function Streamers(){
 const [streamers,setStreamers]=useState<Streamer[]>([]); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
 useEffect(()=>{fetch('/api/streamers',{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not load streamers');return data;}).then(data=>setStreamers(data.streamers||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 return <section className="section"><div className="container"><div className="staff-head"><div><h1 className="title">COMMUNITY <span className="red">STREAMERS</span></h1><p className="lead">Creators sharing their Legend RolePlay stories. This list updates automatically when a member receives the Streamer role.</p></div><span className="staff-rank">LIVE DISCORD SYNC</span></div>
 {loading&&<div className="notice">Loading streamers from Discord…</div>}{error&&<div className="notice">Could not load streamers: {error}. Check the bot token and Server Members Intent.</div>}
 {!loading&&!error&&streamers.length===0&&<div className="card empty-streamers"><h2>No streamers yet</h2><p>Give a member the Streamer role in Discord and they will appear here automatically.</p></div>}
 <div className="grid streamer-grid">{streamers.map(s=><article className="card streamer-card" key={s.id}><img src={s.avatar} alt={`${s.displayName} avatar`} /><div><span className="streamer-tag">✦ OFFICIAL STREAMER</span><h3>{s.displayName}</h3><p>@{s.username}</p><small>Discord ID: {s.id}</small></div></article>)}</div>
 </div></section>
}
