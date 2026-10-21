import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
const STAFF_ROLE_IDS=['1559253919073308693','1559253927617237012','1559253934923714640','1559253939243847700','1559253969023533267','1559253977030205450','1559253985418805312','1559253989583884399','1559254002099687546','1559254006696640572','1559254015005433947','1559254019598327809'];
export async function GET(){
 try{
  const secret=process.env.SESSION_SECRET, cookie=(await cookies()).get('legend_discord_session')?.value;
  if(!secret||!cookie)return NextResponse.json({error:'Sign in with Discord first.'},{status:401});
  const {payload}=await jwtVerify(cookie,new TextEncoder().encode(secret)), id=String(payload.discordId||'');
  const guild=process.env.DISCORD_GUILD_ID,token=process.env.DISCORD_BOT_TOKEN,channel=process.env.DISCORD_STAFF_LOG_CHANNEL_ID||'1559255890006245497';
  if(!guild||!token||!id)return NextResponse.json({error:'Discord configuration is missing.'},{status:500});
  const m=await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${id}`,{headers:{Authorization:`Bot ${token}`},cache:'no-store'});
  if(!m.ok)return NextResponse.json({error:'Unable to verify staff access.'},{status:403});
  const member=await m.json();if(!member.roles.some((r:string)=>STAFF_ROLE_IDS.includes(r)||(process.env.DISCORD_WHITELISTER_ROLE_ID||'')===r))return NextResponse.json({error:'Staff access required.'},{status:403});
  const r=await fetch(`https://discord.com/api/v10/channels/${channel}/messages?limit=30`,{headers:{Authorization:`Bot ${token}`},cache:'no-store'});
  if(!r.ok)throw new Error(`Discord logs API ${r.status}`);
  const messages=await r.json();
  return NextResponse.json({logs:messages.map((x:any)=>({id:x.id,author:x.author?.username||'System',content:x.content||x.embeds?.[0]?.title||'Embed log',timestamp:x.timestamp,avatar:x.author?.avatar?`https://cdn.discordapp.com/avatars/${x.author.id}/${x.author.avatar}.png?size=64`:''}))});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load logs.'},{status:500})}
}
