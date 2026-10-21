import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export async function GET(){
 try{
  const secret=process.env.SESSION_SECRET;
  const token=(await cookies()).get('legend_discord_session')?.value;
  if(!secret||!token)return NextResponse.json({user:null},{status:401});
  const {payload}=await jwtVerify(token,new TextEncoder().encode(secret));
  const id=String(payload.discordId||'');
  const username=String(payload.username||'Discord User');
  const displayName=String(payload.globalName||username);
  const avatarHash=String(payload.avatar||'');
  const avatar=avatarHash ? `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.${avatarHash.startsWith('a_')?'gif':'png'}?size=128` : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id||'0')%5n)}.png`;
  return NextResponse.json({user:{id,username,displayName,avatar}},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({user:null},{status:401})}
}
