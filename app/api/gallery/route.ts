import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import fs from 'node:fs/promises';
import path from 'node:path';
export const runtime = 'nodejs';
const file = path.join(process.cwd(), 'data', 'gallery.json');
async function read(){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return []}}
async function staff(){
 const secret=process.env.SESSION_SECRET;
 const cookie=(await cookies()).get('legend_discord_session')?.value;
 if(!secret||!cookie) throw Object.assign(new Error('Sign in with Discord first.'),{status:401});
 const {payload}=await jwtVerify(cookie,new TextEncoder().encode(secret));
 const id=String(payload.discordId||''),guild=process.env.DISCORD_GUILD_ID,token=process.env.DISCORD_BOT_TOKEN;
 if(!id||!guild||!token) throw Object.assign(new Error('Discord configuration is missing.'),{status:500});
 const r=await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${id}`,{headers:{Authorization:`Bot ${token}`},cache:'no-store'});
 if(!r.ok) throw Object.assign(new Error('Could not verify Discord membership.'),{status:403});
 const m:any=await r.json();
 const roles=['1559253919073308693','1559253927617237012','1559253934923714640','1559253939243847700','1559253969023533267','1559253977030205450','1559253985418805312','1559253989583884399','1559254002099687546','1559254006696640572','1559254015005433947','1559254019598327809'];
 if(!(m.roles||[]).some((x:string)=>roles.includes(x))) throw Object.assign(new Error('Staff access required.'),{status:403});
}
export async function GET(){return NextResponse.json({photos:await read()},{headers:{'Cache-Control':'no-store'}})}
export async function POST(req:Request){try{await staff();const b=await req.json();const src=String(b.src||'');const name=String(b.name||'image').slice(0,180);const caption=String(b.caption||'').slice(0,240);if(!src.startsWith('/uploads/'))return NextResponse.json({message:'Upload the image before saving it.'},{status:400});const photos=await read();const photo={id:crypto.randomUUID(),name,src,caption,createdAt:new Date().toISOString()};photos.unshift(photo);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(photos,null,2));return NextResponse.json({photo,photos})}catch(e:any){return NextResponse.json({message:e.message||'Could not save gallery image.'},{status:e.status||500})}}
export async function DELETE(req:Request){try{await staff();const {id}=await req.json();const photos=(await read()).filter((p:any)=>p.id!==id);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(photos,null,2));return NextResponse.json({photos})}catch(e:any){return NextResponse.json({message:e.message||'Could not delete gallery image.'},{status:e.status||500})}}
