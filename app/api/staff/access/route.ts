
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export const dynamic = 'force-dynamic';

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

const STAFF_ROLE_IDS: string[] = Object.values(ROLE_IDS);

const LEADERSHIP_ROLE_IDS: string[] = [
  ROLE_IDS.owner,
  ROLE_IDS.coOwner,
  ROLE_IDS.developer,
];

// Cache verified roles for 45 seconds to reduce Discord API requests.
const roleCache = new Map<
  string,
  { roles: string[]; expiresAt: number }
>();

// Avoid repeatedly calling Discord while a rate limit is active.
const rateLimitedUntil = new Map<string, number>();

const CACHE_TTL = 45_000;

function jsonError(reason: string, status: number, retryAfter?: number) {
  const headers: Record<string, string> = {};

  if (retryAfter !== undefined) {
    headers['Retry-After'] = String(retryAfter);
  }

  return NextResponse.json(
    { allowed: false, leadership: false, reason },
    { status, headers }
  );
}

export async function GET(request: Request) {
  try {
    const secret = process.env.SESSION_SECRET;
    const cookie = (await cookies()).get('legend_discord_session')?.value;

    if (!secret || !cookie) {
      return jsonError('Connect to Discord first.', 401);
    }

    let id: string;

    try {
      const { payload } = await jwtVerify(
        cookie,
        new TextEncoder().encode(secret)
      );

      id = String(payload.discordId || '');
    } catch {
      return jsonError('Your Discord session expired. Sign in again.', 401);
    }

    const guild = process.env.DISCORD_GUILD_ID;
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!id || !guild || !token) {
      console.error('[STAFF ACCESS] Missing Discord configuration.');
      return jsonError('Discord server configuration is missing.', 500);
    }

    const scope = new URL(request.url).searchParams.get('scope');
    const cacheKey = `${guild}:${id}`;
    const now = Date.now();

    let roles: string[];

    // Reuse recently verified roles instead of calling Discord every time.
    const cached = roleCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      roles = cached.roles;
    } else {
      const limitedUntil = rateLimitedUntil.get(cacheKey) || 0;

      if (limitedUntil > now) {
        const retryAfter = Math.max(
          1,
          Math.ceil((limitedUntil - now) / 1000)
        );

        return jsonError(
          'Discord is temporarily rate-limiting requests. Please retry shortly.',
          429,
          retryAfter
        );
      }

      let response: Response;

      try {
        response = await fetch(
          `https://discord.com/api/v10/guilds/${guild}/members/${id}`,
          {
            headers: {
              Authorization: `Bot ${token}`,
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(8000),
          }
        );
      } catch (error) {
        console.error('[STAFF ACCESS] Discord request failed:', error);
        return jsonError('Could not connect to Discord. Please retry.', 503);
      }

      if (response.status === 429) {
        let retrySeconds = Number(response.headers.get('Retry-After') || 0);

        try {
          const body = await response.clone().json();
          if (Number.isFinite(body.retry_after)) {
            retrySeconds = Math.max(retrySeconds, Number(body.retry_after));
          }
        } catch {
          // Use the Retry-After header if the response has no JSON body.
        }

        retrySeconds = Math.max(1, Math.ceil(retrySeconds || 5));

        rateLimitedUntil.set(
          cacheKey,
          Date.now() + retrySeconds * 1000
        );

        console.warn(
          `[STAFF ACCESS] Discord rate limit; retry after ${retrySeconds}s`
        );

        return jsonError(
          'Discord is temporarily rate-limiting requests. Please retry shortly.',
          429,
          retrySeconds
        );
      }

      rateLimitedUntil.delete(cacheKey);

      if (response.status === 404) {
        return jsonError(
          'You are not a member of the configured Discord server. Check DISCORD_GUILD_ID.',
          403
        );
      }

      if (response.status === 401 || response.status === 403) {
        console.error(
          '[STAFF ACCESS] Discord bot authentication/permission error:',
          response.status
        );

        return jsonError(
          'The Discord bot cannot verify membership. Check the bot token and server access.',
          502
        );
      }

      if (!response.ok) {
        console.error('[STAFF ACCESS] Discord API status:', response.status);
        return jsonError('Discord membership verification failed.', 502);
      }

      const member = await response.json();
      roles = Array.isArray(member.roles)
        ? member.roles.filter((role: unknown): role is string =>
            typeof role === 'string'
          )
        : [];

      roleCache.set(cacheKey, {
        roles,
        expiresAt: Date.now() + CACHE_TTL,
      });
    }

    const extraWhitelisterRole =
      process.env.DISCORD_WHITELISTER_ROLE_ID || '';

    const leadership = roles.some((role) =>
      LEADERSHIP_ROLE_IDS.includes(role)
    );

    const allowed =
      roles.some((role) => STAFF_ROLE_IDS.includes(role)) ||
      (!!extraWhitelisterRole && roles.includes(extraWhitelisterRole));

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
    console.error('[STAFF ACCESS] Unexpected error:', error);
    return jsonError('An unexpected server error occurred.', 500);
  }
}
