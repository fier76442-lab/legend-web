import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {jwtVerify} from 'jose';
import {discordCreateMessage} from '@/lib/discord';

export async function POST(req:Request){
 try{
  const data=await req.json();
  const secret=process.env.SESSION_SECRET;
  const token=(await cookies()).get('legend_discord_session')?.value;
  if(!secret||!token) return NextResponse.json({message:'Connect your Discord account before submitting the application.'},{status:401});
  const {payload}=await jwtVerify(token,new TextEncoder().encode(secret));
  const applicantId=String(payload.discordId||'');
  if(!applicantId) return NextResponse.json({message:'Discord account could not be identified.'},{status:401});
  const lines=Object.entries(data).map(([k,v])=>`**${k}:** ${String(v).slice(0,900)}`).join('\n');
  const channel=process.env.DISCORD_WHITELIST_REVIEW_CHANNEL_ID||'1559255919282622616';
  const payloadDiscord={embeds:[{title:'New Whitelist Application',description:`**Applicant:** <@${applicantId}>\n**Discord ID:** ${applicantId}\n\n${lines}`.slice(0,5900),color:16724787,footer:{text:applicantId}}],components:[{type:1,components:[{type:2,style:3,label:'Accept',custom_id:'whitelist_accept'},{type:2,style:4,label:'Denied',custom_id:'whitelist_deny'}]}]};
  await discordCreateMessage(channel,payloadDiscord);
  return NextResponse.json({message:'Application submitted successfully.'});
 }catch(e){return NextResponse.json({message:e instanceof Error?e.message:'Failed to submit application.'},{status:500})}
}
