
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
};

const STAFF_ROLE_IDS = Object.values(ROLE_IDS);

const LEADERSHIP_ROLE_IDS = [
  ROLE_IDS.owner,
  ROLE_IDS.coOwner,
  ROLE_IDS.developer,
];

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

    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guild}/members/${id}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.error(
        '[STAFF ACCESS] Discord API status:',
        response.status
      );

      return NextResponse.json(
        {
          allowed: false,
          leadership: false,
          reason:
            response.status === 404
              ? 'You are not a member of the configured Discord server.'
              : response.status === 429
                ? 'Discord is rate-limiting requests. Please try again shortly.'
                : 'Could not verify your Discord roles.',
        },
        { status: response.status === 429 ? 429 : 403 }
      );
    }

    const member = await response.json();
    const roles: string[] = Array.isArray(member.roles)
      ? member.roles
      : [];

    const extraWhitelisterRole =
      process.env.DISCORD_WHITELISTER_ROLE_ID || '';

    const leadership = roles.some((role) =>
      LEADERSHIP_ROLE_IDS.includes(role)
    );

    const allowed =
      roles.some((role) => STAFF_ROLE_IDS.includes(role)) ||
      (!!extraWhitelisterRole && roles.includes(extraWhitelisterRole));

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
      {
        allowed: scope === 'leadership' ? leadership : allowed,
        leadership,
        discordId: id,
      },
      {
        status:
          scope === 'leadership'
            ? leadership
              ? 200
              : 403
            : allowed
              ? 200
              : 403,
      }
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
