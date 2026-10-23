import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const ROLE_WHITELISTER = '1562845673311965354';

const ADMIN_ROLES = [
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

const ALLOWED = [
  '1562845740407984218', // Whitelisted
  '1562845752093442200', // Banned
  '1559254052410490960', // Warn
  '1559254106957291601', // WL Chance
  '1559254086669566073', // Waiting For Check
  '1559254091073462472', // Waiting For Admin
];

async function discord<T>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is missing on the server');
  }

  const r = await fetch('https://discord.com/api/v10' + path, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });

  if (!r.ok) {
    throw new Error(
      `Discord API returned ${r.status}. Check bot permissions and IDs.`
    );
  }

  return (r.status === 204 ? {} : await r.json()) as T;
}

export async function POST(req: Request) {
  try {
    const secret = process.env.SESSION_SECRET;
    const cookie = (await cookies()).get('legend_discord_session')?.value;

    if (!secret || !cookie) {
      return NextResponse.json(
        { message: 'Connect Discord first.' },
        { status: 401 }
      );
    }

    const { payload } = await jwtVerify(
      cookie,
      new TextEncoder().encode(secret)
    );

    const actorId = String(payload.discordId || '');
    const guild = process.env.DISCORD_GUILD_ID;

    if (!guild || !actorId) {
      return NextResponse.json(
        { message: 'Discord session/server configuration is missing.' },
        { status: 500 }
      );
    }

    const actor = await discord<{ roles: string[] }>(
      `/guilds/${guild}/members/${actorId}`
    );

    const isAdmin = ADMIN_ROLES.some((id) => actor.roles.includes(id));
    const isWhitelist = actor.roles.includes(ROLE_WHITELISTER);

    const { userId, roleId, action } = await req.json();

    if (
      !/^\d{17,20}$/.test(String(userId)) ||
      !ALLOWED.includes(String(roleId)) ||
      !['add', 'remove'].includes(action)
    ) {
      return NextResponse.json(
        { message: 'Invalid user ID, role or action.' },
        { status: 400 }
      );
    }

    const allowedForWhitelister = [
      '1562845740407984218', // Whitelisted
      '1562845752093442200', // Banned
      '1559254052410490960', // Warn
      '1559254106957291601', // WL Chance
      '1559254086669566073', // Waiting For Check
      '1559254091073462472', // Waiting For Admin
    ];

    if (
      !isAdmin &&
      !(isWhitelist && allowedForWhitelister.includes(String(roleId)))
    ) {
      return NextResponse.json(
        {
          message:
            'Access denied: your Discord role cannot manage this role.',
        },
        { status: 403 }
      );
    }

    const target = await discord<{ user?: { id: string } }>(
      `/guilds/${guild}/members/${userId}`
    );

    if (!target.user?.id) {
      return NextResponse.json(
        {
          message:
            'Member not found in the configured Discord server.',
        },
        { status: 404 }
      );
    }

    const path = `/guilds/${guild}/members/${userId}/roles/${roleId}`;

    await discord(path, action === 'add' ? 'PUT' : 'DELETE');

    return NextResponse.json({
      message: `Role ${action === 'add' ? 'given' : 'removed'} successfully.`,
    });
  } catch (e) {
    console.error('[ROLE MANAGER]', e);

    const message = e instanceof Error ? e.message : 'Unexpected error';
    const status =
      message.includes('JWT') || message.includes('JWS') ? 401 : 500;

    return NextResponse.json(
      {
        message:
          status === 500
            ? 'Unable to update role. Check server logs, bot role hierarchy and Manage Roles permission.'
            : 'Your Discord session expired. Connect Discord again.',
      },
      { status }
    );
  }
}