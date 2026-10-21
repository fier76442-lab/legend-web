import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'DISCORD_CLIENT_ID or DISCORD_REDIRECT_URI is missing' }, { status: 500 });
  }
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'identify guilds',
  });
  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}
