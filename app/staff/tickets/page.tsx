'use client';
import { useCallback, useEffect, useState } from 'react';

type Ticket = { id:string; threadId:string; title:string; description:string; status:'open'|'closed'; claimedBy:string; createdAt:string; author:string };
export default function StaffTickets() {
  const [tickets,setTickets]=useState<Ticket[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [reply,setReply]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState('');
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const load=useCallback(async()=>{try{const a=await fetch('/api/staff/access');setAllowed(a.ok);if(!a.ok)throw new Error('Staff access required. Sign in with Discord.');const r=await fetch('/api/tickets',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.message||'Could not load tickets.');setTickets(j.tickets||[]);setError('')}catch(e:any){setError(e.message||'Could not load tickets.')}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  async function act(t:Ticket,action:string){setBusy(t.id+action);setNotice('');try{const r=await fetch('/api/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,ticketId:t.id,threadId:t.threadId,message:reply[t.id]||''})});const j=await r.json();if(!r.ok)throw new Error(j.message||'Action failed');setNotice(j.message);if(action==='reply')setReply(v=>({...v,[t.id]:''}));await load()}catch(e:any){setNotice(e.message||'Ticket action failed.')}finally{setBusy('')}}
  if(allowed===null&&loading)return <section className="section"><div className="container"><div className="notice">Verifying Discord staff access…</div></div></section>;
  if(!allowed)return <section className="section"><div className="container"><h1 className="title">TICKET <span className="red">CENTER</span></h1><div className="notice">{error||'Staff access required.'} <a className="red" href="/api/auth/discord">Sign in with Discord</a></div></div></section>;
  return <section className="section"><div className="container"><p className="intro-kicker">LEGEND ROLE PLAY • STAFF TOOLS</p><h1 className="title">TICKET <span className="red">CENTER</span></h1><p className="lead">Claim, reply to, close and reopen support tickets. Actions are sent to Discord.</p>
    <div className="actions" style={{justifyContent:'flex-start',marginBottom:20}}><button className="btn" onClick={()=>{setLoading(true);load()}}>↻ Refresh tickets</button><a className="btn" href="/tickets">Open ticket form</a><a className="btn" href="/admin">Staff Panel</a></div>
    {notice&&<div className="notice" style={{marginBottom:16}}>{notice}</div>}{error&&<div className="notice">{error}</div>}
    {loading?<div className="notice">Loading tickets from Discord…</div>:tickets.length===0?<div className="card"><h3>No tickets found</h3><p>New tickets submitted on the website will appear here when the bot can create ticket threads in the configured log channel.</p></div>:
    <div className="grid">{tickets.map(t=><article className="card" key={t.id} style={{gridColumn:'1 / -1',borderColor:t.status==='closed'?'rgba(255,255,255,.16)':'rgba(239,32,32,.45)'}}>
      <div style={{display:'flex',gap:12,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}><h2 style={{margin:0,fontSize:25}}>{t.title}</h2><span className="staff-rank">{t.status==='closed'?'CLOSED':'OPEN'}</span></div>
      <p style={{margin:'12px 0',whiteSpace:'pre-wrap',lineHeight:1.7}}>{t.description}</p>
      <small style={{color:'#aaa'}}>Created {new Date(t.createdAt).toLocaleString()} · Discord message {t.id}{t.claimedBy?` · Claimed by ${t.claimedBy}`:''}</small>
      <div className="actions" style={{justifyContent:'flex-start',marginTop:18}}>
        {t.status==='open'?<><button className="btn btn-red" disabled={!!busy} onClick={()=>act(t,'claim')}>{busy===t.id+'claim'?'Claiming…':'Claim ticket'}</button><button className="btn" disabled={!!busy} onClick={()=>act(t,'close')}>{busy===t.id+'close'?'Closing…':'Close ticket'}</button></>:<button className="btn btn-red" disabled={!!busy} onClick={()=>act(t,'reopen')}>Reopen ticket</button>}
      </div>
      {t.status==='open'&&<div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}><input style={{flex:'1 1 260px',minWidth:0,border:'1px solid rgba(255,255,255,.15)',borderRadius:9,padding:12,background:'#090909',color:'#fff'}} value={reply[t.id]||''} onChange={e=>setReply(v=>({...v,[t.id]:e.target.value}))} placeholder="Reply in the ticket thread…"/><button className="btn" disabled={!!busy||!(reply[t.id]||'').trim()} onClick={()=>act(t,'reply')}>{busy===t.id+'reply'?'Sending…':'Send reply'}</button></div>}
    </article>)}</div>}
  </div></section>;
}
