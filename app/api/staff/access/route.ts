import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const ROLE_IDS = {
  owner: '1562845546853441556',
  coOwner: '1562845556337016952',
  supervisor: '1562845563525926952',
  serverManager: '1562845571662745601',
  developer: '1562845567611310130',
  headAdmin: '1562845588637225123',
  headChecker: '1562845634736824420',
  headWhitelister: '1562845638884855818',
  admin: '1562845660640841729',
  trialAdmin: '1562875050971893900',
  moderator: '1562845664042553477',
  trialModerator: '1562874969162256490',
  pcChecker: '1562845668303704074',
  whitelister: '1562845673311965354',
  supportTeam: '1562845680857251943',

  staff: [
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
  ],
};

export async function GET(request: Request) {
  try {
    const secret = process.env.SESSION_SECRET;
    const cookie = (await cookies()).get('legend_discord_session')?.value;

    if (!secret || !cookie) {
      return NextResponse.json(
        {
          allowed: false,
          leadership: false,
          reason: 'Connect to Discord first.',
        },
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

    if (!id || !guild || !token) {
      return NextResponse.json(
        {
          allowed: false,
          leadership: false,
          reason: 'Discord server configuration is missing.',
        },
        { status: 500 }
      );
    }

    const r = await fetch(
      `https://discord.com/api/v10/guilds/${guild}/members/${id}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: 'no-store',
      }
    );

    if (!r.ok) {
      console.error('[STAFF ACCESS] Discord API status:', r.status);

      return NextResponse.json(
        {
          allowed: false,
          leadership: false,
          reason: 'Could not verify your Discord roles.',
        },
        { status: 403 }
      );
    }

    const member = await r.json();
    const roles: string[] = Array.isArray(member.roles)
      ? member.roles
      : [];

    const leadership = [
      ROLE_IDS.owner,
      ROLE_IDS.coOwner,
      ROLE_IDS.developer,
    ].some((role) => roles.includes(role));

    const allowed = roles.some(
      (role) =>
        ROLE_IDS.staff.includes(role) ||
        role === (process.env.DISCORD_WHITELISTER_ROLE_ID || '')
    );

    const scope = new URL(request.url).searchParams.get('scope');

    if (scope === 'leadership' && !leadership) {
      return NextResponse.json(
        {
          allowed: false,
          leadership: false,
          reason: 'Owner, Co Owner or Developer access required.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { allowed, leadership, discordId: id },
      { status: allowed ? 200 : 403 }
    );
  } catch (error) {
    console.error('[STAFF ACCESS]', error);

    return NextResponse.json(
      {
        allowed: false,
        leadership: false,
        reason: 'Your Discord session expired. Sign in again.',
      },
      { status: 401 }
    );
  }
}