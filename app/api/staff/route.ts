
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { discordCreateMessage } from '@/lib/discord';

const STAFF_ROLES = [
  { id: '1562845546853441556', rank: 'Owner', group: 'Owners' },
  { id: '1562845556337016952', rank: 'Co Owner', group: 'Owners' },

  { id: '1562845567611310130', rank: 'Developer', group: 'Management' },
  { id: '1562845563525926952', rank: 'Supervisor', group: 'Management' },
  { id: '1562845571662745601', rank: 'Server Manager', group: 'Management' },

  { id: '1562845588637225123', rank: 'Head Admin', group: 'High Staff' },
  { id: '1562845634736824420', rank: 'Head Checker', group: 'High Staff' },
  { id: '1562845638884855818', rank: 'Head Whitelister', group: 'High Staff' },

  { id: '1562845660640841729', rank: 'Admin', group: 'Staffs' },
  { id: '1562875050971893900', rank: 'Trial Admin', group: 'Staffs' },
  { id: '1562845664042553477', rank: 'Moderator', group: 'Staffs' },
  { id: '1562874969162256490', rank: 'Trial Moderator', group: 'Staffs' },
  { id: '1562845668303704074', rank: 'PC Checker', group: 'Staffs' },
  { id: '1562845673311965354', rank: 'Whitelister', group: 'Staffs' },
  { id: '1562845680857251943', rank: 'Support Team', group: 'Staffs' },
];

export async function GET() {
  try {
    const guild = process.env.DISCORD_GUILD_ID;
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!guild || !token) {
      return NextResponse.json(
        { error: 'Discord server configuration is missing.' },
        { status: 500 }
      );
    }

    const members: any[] = [];
    let after = '';

    // Fetch members in batches of up to 1000.
    while (true) {
      const params = new URLSearchParams({ limit: '1000' });

      if (after) {
        params.set('after', after);
      }

      const response = await fetch(
        `https://discord.com/api/v10/guilds/${guild}/members?${params.toString()}`,
        {
          headers: {
            Authorization: `Bot ${token}`,
          },
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        const detail = await response.text();

        console.error(
          '[STAFF LIST] Discord API:',
          response.status,
          detail.slice(0, 500)
        );

        return NextResponse.json(
          {
            error:
              response.status === 403
                ? 'Discord denied access. Check the bot permissions and Server Members Intent.'
                : `Could not fetch Discord members (HTTP ${response.status}).`,
          },
          { status: 502 }
        );
      }

      const batch: any = await response.json();

      if (!Array.isArray(batch)) {
        return NextResponse.json(
          { error: 'Discord returned an unexpected member list.' },
          { status: 502 }
        );
      }

      members.push(...batch);

      if (batch.length < 1000) {
        break;
      }

      after = String(batch[batch.length - 1]?.user?.id || '');

      if (!after) {
        break;
      }
    }

    const staff: {
      id: string;
      username: string;
      displayName: string;
      avatar: string;
      rank: string;
      group: string;
    }[] = [];

    for (const member of members) {
      const user = member.user;

      if (!user?.id) {
        continue;
      }

      const roles: string[] = Array.isArray(member.roles)
        ? member.roles
        : [];

      // The first matching role in STAFF_ROLES determines the displayed rank.
      const selectedRole = STAFF_ROLES.find((role) =>
        roles.includes(role.id)
      );

      if (!selectedRole) {
        continue;
      }

      staff.push({
        id: user.id,
        username: user.username || 'Unknown',
        displayName:
          member.nick ||
          user.global_name ||
          user.username ||
          'Unknown',
        avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/0.png`,
        rank: selectedRole.rank,
        group: selectedRole.group,
      });
    }

    // Sort members by the order defined in STAFF_ROLES.
    staff.sort((a, b) => {
      const rankA = STAFF_ROLES.findIndex((role) => role.rank === a.rank);
      const rankB = STAFF_ROLES.findIndex((role) => role.rank === b.rank);

      return rankA - rankB || a.displayName.localeCompare(b.displayName);
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error('[STAFF LIST]', error);

    return NextResponse.json(
      { error: 'Failed to load staff. Check the server logs.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const data: unknown = await req.json();

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json(
        { message: 'Invalid application data.' },
        { status: 400 }
      );
    }

    const secret = process.env.SESSION_SECRET;
    const session = (await cookies()).get(
      'legend_discord_session'
    )?.value;

    if (!secret || !session) {
      return NextResponse.json(
        {
          message:
            'Connect your Discord account before submitting the application.',
        },
        { status: 401 }
      );
    }

    const { payload: sessionPayload } = await jwtVerify(
      session,
      new TextEncoder().encode(secret)
    );

    const applicantId = String(sessionPayload.discordId || '');

    if (!/^\d{17,20}$/.test(applicantId)) {
      return NextResponse.json(
        { message: 'Discord account could not be identified.' },
        { status: 401 }
      );
    }

    const lines = Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => {
        const safeKey = key.slice(0, 100);
        const safeValue = String(value ?? '').slice(0, 900);

        return `**${safeKey}:** ${safeValue}`;
      })
      .join('\n');

    const channel = process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID;

    if (!channel || !/^\d{17,20}$/.test(channel)) {
      return NextResponse.json(
        {
          message:
            'Discord staff review channel is not configured correctly.',
        },
        { status: 500 }
      );
    }

    const payload = {
      embeds: [
        {
          title: 'New Staff Team Application',
          description: (
            `**Applicant:** <@${applicantId}>\n` +
            `**Discord ID:** ${applicantId}\n\n` +
            lines
          ).slice(0, 5900),
          color: 16711680,
          footer: { text: applicantId },
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3,
              label: 'Accept',
              custom_id: 'staff_accept',
            },
            {
              type: 2,
              style: 4,
              label: 'Denied',
              custom_id: 'staff_deny',
            },
          ],
        },
      ],
    };

    await discordCreateMessage(channel, payload);

    return NextResponse.json({
      message: 'Application submitted successfully.',
    });
  } catch (error) {
    console.error('[STAFF APPLICATION]', error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to submit application.',
      },
      { status: 500 }
    );
  }
}
