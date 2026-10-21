import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import fs from 'node:fs/promises';
import path from 'node:path';
const file = path.join(process.cwd(), 'data', 'store.json');
async function staff(){
 const secret=process.env.SESSION_SECRET; const cookie=(await cookies()).get('legend_discord_session')?.value;
 if(!secret||!cookie) throw new Error('Sign in with Discord first.');
 const {payload}=await jwtVerify(cookie,new TextEncoder().encode(secret)); const id=String(payload.discordId||'');
 const guild=process.env.DISCORD_GUILD_ID,token=process.env.DISCORD_BOT_TOKEN;
 if(!id||!guild||!token) throw new Error('Discord configuration is missing.');
 const r=await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${id}`,{headers:{Authorization:`Bot ${token}`},cache:'no-store'});
 if(!r.ok) throw new Error('Could not verify Discord membership.'); const m=await r.json();
 const roles=['1559253919073308693','1559253927617237012','1559253934923714640','1559253939243847700','1559253969023533267','1559253977030205450','1559253985418805312','1559253989583884399','1559254002099687546','1559254006696640572','1559254015005433947','1559254019598327809'];
 if(!(m.roles||[]).some((x:string)=>roles.includes(x))) throw new Error('Staff access required.');
}
async function read(){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return []}}
export async function GET(){return NextResponse.json({items:await read()},{headers:{'Cache-Control':'no-store'}})}
export async function POST(req:Request){try{await staff();const b=await req.json();const items=await read();const item={id:crypto.randomUUID(),name:String(b.name||''),category:String(b.category||'Cars'),description:String(b.description||''),price:String(b.price||''),image:String(b.image||'')};if(!item.name) return NextResponse.json({message:'Vehicle name required.'},{status:400});items.push(item);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(items,null,2));return NextResponse.json({item})}catch(e:any){return NextResponse.json({message:e.message||'Could not save store item.'},{status: e.message?.includes('access')||e.message?.includes('Discord')?403:500})}}
export async function DELETE(req:Request){try{await staff();const {id}=await req.json();const items=(await read()).filter((x:any)=>x.id!==id);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(items,null,2));return NextResponse.json({items})}catch(e:any){return NextResponse.json({message:e.message||'Could not delete item.'},{status:403})}}
