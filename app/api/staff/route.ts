import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { discordCreateMessage } from '@/lib/discord';

export async function POST(req: Request) {
  try {
    const data: unknown = await req.json();

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
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
        return "**" + safeKey + ":** " + safeValue;
      })
      .join('\n');

    const channel = process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID;

    if (!channel || !/^\d{17,20}$/.test(channel)) {
      return NextResponse.json(
        { message: 'Discord staff review channel is not configured correctly.' },
        { status: 500 }
      );
    }

    const payload = {
      embeds: [
        {
          title: 'New Staff Team Application',
          description: (
            "**Applicant:** <@" + applicantId + ">\n" +
            "**Discord ID:** " + applicantId + "\n\n" + lines
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



