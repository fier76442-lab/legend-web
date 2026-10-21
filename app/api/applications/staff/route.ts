import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {jwtVerify} from 'jose';
import {discordCreateMessage} from '@/lib/discord';

export async function POST(req:Request){
 try{
  const data=await req.json();
  const secret=process.env.SESSION_SECRET;
  const session=(await cookies()).get('legend_discord_session')?.value;
  if(!secret||!session) return NextResponse.json({message:'Connect your Discord account before submitting the application.'},{status:401});
  const {payload: sessionPayload}=await jwtVerify(session,new TextEncoder().encode(secret));
  const applicantId=String(payload.discordId||'');
  if(!/^\d{17,20}$/.test(applicantId)) return NextResponse.json({message:'Discord account could not be identified.'},{status:401});
  const lines=Object.entries(data).map(([k,v])=>`**${k}:** ${String(v).slice(0,900)}`).join('\n');
  const channel=process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID;
  if(!channel) return NextResponse.json({message:'Discord channel is not configured yet.'},{status:500});
  const payload={embeds:[{title:'New Staff Team Application',description:`**Applicant:** <@${applicantId}>\n**Discord ID:** ${applicantId}\n\n${lines}`.slice(0,5900),color:16711680,footer:{text:applicantId}}],components:[{type:1,components:[{type:2,style:3,label:'Accept',custom_id:'staff_accept'},{type:2,style:4,label:'Denied',custom_id:'staff_deny'}]}]};
  await discordCreateMessage(channel,payload);
  return NextResponse.json({message:'Application submitted successfully.'});
 }catch(e){return NextResponse.json({message:e instanceof Error?e.message:'Failed to submit application.'},{status:500})}
}
