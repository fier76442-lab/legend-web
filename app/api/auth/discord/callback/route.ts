import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  if (!code) return NextResponse.redirect(`${origin}/staff?discord=cancelled`);

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const secret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !redirectUri || !secret) {
    return NextResponse.redirect(`${origin}/staff?discord=config_error`);
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) throw new Error(await tokenResponse.text());
    const tokens = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userResponse.ok) throw new Error(await userResponse.text());
    const user = await userResponse.json();

    const jwt = await new SignJWT({ discordId: user.id, username: user.username, globalName: user.global_name || user.username, avatar: user.avatar || '' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(secret));

    const response = NextResponse.redirect(`${origin}/staff?discord=connected`);
    response.cookies.set('legend_discord_session', jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error('[DISCORD OAUTH]', error);
    return NextResponse.redirect(`${origin}/staff?discord=error`);
  }
}
