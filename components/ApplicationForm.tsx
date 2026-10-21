/* Client-side form UI. Discord OAuth2 is connected by the API routes after env setup. */
'use client';
import {useState} from 'react';

type Question={name:string;label:string;placeholder:string;type?:'input'|'textarea'|'select';options?:string[]};

export default function ApplicationForm({title,intro,endpoint,questions}:{title:string;intro:string;endpoint:string;questions:Question[]}){
 const [status,setStatus]=useState('');
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();
  const form = e.currentTarget; // Keep the form reference before awaiting fetch.
  setStatus('Sending...');
  try {
   const data=Object.fromEntries(new FormData(form).entries());
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const j=await r.json().catch(()=>({message:'Unexpected server response.'}));
   setStatus(j.message||'Done.');
   if(r.ok) form.reset();
  } catch (error) {
   console.error('[APPLICATION FORM]', error);
   setStatus('Could not submit the application. Please try again.');
  }
 }
 return <section className="section"><div className="container form">
  <h1 className="title">{title}</h1><p className="lead">{intro}</p>
  <div className="notice">Connect Discord before submitting so your application is linked to your account. <a className="red" href="/api/auth/discord">Connect Discord ↗</a></div>
  <form onSubmit={submit}>
   {questions.map(q=><div className="field" key={q.name}><label>{q.label}</label>
    {q.type==='textarea'?<textarea name={q.name} placeholder={q.placeholder} required/>:
     q.type==='select'?<select name={q.name} defaultValue="" required><option value="" disabled>Select...</option>{(q.options||[]).map(o=><option key={o}>{o}</option>)}</select>:
     <input name={q.name} placeholder={q.placeholder} required/>}
   </div>)}
   <button className="btn btn-red" type="submit">Submit Application</button>
  </form>
  {status&&<p className="notice">{status}</p>}
 </div></section>
}