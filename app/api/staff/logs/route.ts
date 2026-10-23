import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const STAFF_ROLE_IDS = [
  '1562845546853441556', // Owner
  '1562845556337016952', // Co Owner
  '1562845563525926952', // Supervisor
  '1562845571662745601', // Server Manager
  '1562845567611310130', // Developer
  '1562845588637225123', // Head Admin
  '1562845634736824420', // Head Checker
  '1562845638884855818', // Head Whitelister
  '1562845660640841729', // Admin
  '1562875050971893900', // Trial Admin
  '1562845664042553477', // Moderator
  '1562874969162256490', // Trial Moderator
  '1562845668303704074', // PC Checker
  '1562845673311965354', // Whitelister
  '1562845680857251943', // Support Team
];

export async function GET() {
  try {
    const secret = process.env.SESSION_SECRET;
    const cookie = (await cookies()).get('legend_discord_session')?.value;

    if (!secret || !cookie) {
      return NextResponse.json(
        { error: 'Sign in with Discord first.' },
        { status: 401 }
      );
    }

    const { payload } = await jwtVerify(
      cookie,
      new TextEncoder().encode(secret)
    );

    const id = String(payload.discordId || '');
    const guild = process.env.DISCORD_GUILD_ID;
    const token = process.env.DISCORD_BOT_TOKEN;
    const channel =
      process.env.DISCORD_STAFF_LOG_CHANNEL_ID ||
      '1559255890006245497';

    if (!guild || !token || !id) {
      return NextResponse.json(
        { error: 'Discord configuration is missing.' },
        { status: 500 }
      );
    }

    const m = await fetch(
      `https://discord.com/api/v10/guilds/${guild}/members/${id}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: 'no-store',
      }
    );

    if (!m.ok) {
      return NextResponse.json(
        { error: 'Unable to verify staff access.' },
        { status: 403 }
      );
    }

    const member = await m.json();
    const roles: string[] = Array.isArray(member.roles)
      ? member.roles
      : [];

    const isStaff = roles.some(
      (role) =>
        STAFF_ROLE_IDS.includes(role) ||
        role === (process.env.DISCORD_WHITELISTER_ROLE_ID || '')
    );

    if (!isStaff) {
      return NextResponse.json(
        { error: 'Staff access required.' },
        { status: 403 }
      );
    }

    const r = await fetch(
      `https://discord.com/api/v10/channels/${channel}/messages?limit=30`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: 'no-store',
      }
    );

    if (!r.ok) {
      const discordError: any = await r.json().catch(() => ({}));
      if (r.status === 404 && discordError.code === 10003) {
        return NextResponse.json({ error: 'Discord log channel not found (Unknown Channel). Check DISCORD_STAFF_LOG_CHANNEL_ID in your hosting environment and make sure the bot has access to that channel.' }, { status: 404 });
      }
      if (r.status === 403) {
        return NextResponse.json({ error: 'The bot cannot access the staff log channel. Grant View Channel and Read Message History permissions.' }, { status: 403 });
      }
      throw new Error(`Discord logs API ${r.status}: ${discordError.message || 'request failed'}`);
    }

    const messages = await r.json();

    return NextResponse.json({
      logs: messages.map((x: any) => ({
        id: x.id,
        author: x.author?.username || 'System',
        content:
          x.content || x.embeds?.[0]?.title || 'Embed log',
        timestamp: x.timestamp,
        avatar: x.author?.avatar
          ? `https://cdn.discordapp.com/avatars/${x.author.id}/${x.author.avatar}.png?size=64`
          : '',
      })),
    });
  } catch (e) {
    console.error('[STAFF LOGS]', e);

    return NextResponse.json(
      { error: 'Could not load logs. Check server logs and Discord permissions.' },
      { status: 500 }
    );
  }
}