import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const ROLE_ADMIN='1559254002099687546';
const ROLE_MODERATOR='1559254006696640572';
const ROLE_WHITELISTER=process.env.DISCORD_WHITELISTER_ROLE_ID || '';
const ALLOWED=[
 '1559254056600469665', // Whitelisted
 '1559254049071693904', // Banned
 '1559254052410490960', // Warn
 '1559254106957291601', // WL Chance
 '1559254086669566073', // Waiting For Check
 '1559254091073462472', // Waiting For Admin
];
async function discord<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const token=process.env.DISCORD_BOT_TOKEN;
 if(!token) throw new Error('DISCORD_BOT_TOKEN is missing on the server');
 const r=await fetch('https://discord.com/api/v10'+path,{method,headers:{Authorization:`Bot ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 if(!r.ok) throw new Error(`Discord API returned ${r.status}. Check bot permissions and IDs.`);
 return (r.status===204?{}:await r.json()) as T;
}
export async function POST(req:Request){
 try{
  const secret=process.env.SESSION_SECRET;
  const cookie=(await cookies()).get('legend_discord_session')?.value;
  if(!secret||!cookie) return NextResponse.json({message:'Connect Discord first.'},{status:401});
  const {payload}=await jwtVerify(cookie,new TextEncoder().encode(secret));
  const actorId=String(payload.discordId||'');
  const guild=process.env.DISCORD_GUILD_ID;
  if(!guild||!actorId) return NextResponse.json({message:'Discord session/server configuration is missing.'},{status:500});
  const actor=await discord<{roles:string[]}>(`/guilds/${guild}/members/${actorId}`);
  const isAdmin=['1559253919073308693','1559253927617237012','1559253934923714640','1559253939243847700','1559253969023533267','1559253977030205450','1559254002099687546','1559254006696640572'].some(id=>actor.roles.includes(id));
  const isWhitelist=actor.roles.includes(ROLE_WHITELISTER);
  const {userId,roleId,action}=await req.json();
  if(!/^\d{17,20}$/.test(String(userId))||!ALLOWED.includes(String(roleId))||!['add','remove'].includes(action))
   return NextResponse.json({message:'Invalid user ID, role or action.'},{status:400});
  const allowedForWhitelister=['1559254056600469665','1559254086669566073'];
  if(!isAdmin&&!(isWhitelist&&allowedForWhitelister.includes(String(roleId))))
   return NextResponse.json({message:'Access denied: your Discord role cannot manage this role.'},{status:403});
  const target=await discord<{user:{id:string}}>(`/guilds/${guild}/members/${userId}`);
  if(!target.user?.id) return NextResponse.json({message:'Member not found in the configured Discord server.'},{status:404});
  const path=`/guilds/${guild}/members/${userId}/roles/${roleId}`;
  await discord(path,action==='add'?'PUT':'DELETE');
  return NextResponse.json({message:`Role ${action==='add'?'given':'removed'} successfully.`});
 }catch(e){
  console.error('[ROLE MANAGER]',e);
  const message=e instanceof Error?e.message:'Unexpected error';
  const status=message.includes('JWT')||message.includes('JWS')?401:500;
  return NextResponse.json({message:status===500?'Unable to update role. Check server logs, bot role hierarchy and Manage Roles permission.': 'Your Discord session expired. Connect Discord again.'},{status});
 }
}
