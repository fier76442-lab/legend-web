import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { discordCreateMessage } from '@/lib/discord';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const secret = process.env.SESSION_SECRET;
    const session = (await cookies()).get('legend_discord_session')?.value;
    if (!secret || !session) return NextResponse.json({ message: 'Connect your Discord account before submitting the application.' }, { status: 401 });
    const { payload } = await jwtVerify(session, new TextEncoder().encode(secret));
    const applicantId = String(payload.discordId || '');
    if (!/^\d{17,20}$/.test(applicantId)) return NextResponse.json({ message: 'Discord account could not be identified.' }, { status: 401 });
    const lines = Object.entries(data).map(([key, value]) => `**${key}:** ${String(value).slice(0, 900)}`).join('\n');
    const channel = process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID || '1563168733692960828';
    const message = {
      content: `New Staff Team application from <@${applicantId}>`,
      allowed_mentions: { users: [applicantId] },
      embeds: [{ title: 'New Staff Team Application', description: `**Applicant:** <@${applicantId}>\n**Discord ID:** ${applicantId}\n\n${lines}`.slice(0, 5900), color: 16711680, footer: { text: `staff; applicant=${applicantId}` }, timestamp: new Date().toISOString() }],
      components: [{ type: 1, components: [
        { type: 2, style: 3, label: 'Accept', custom_id: `application:staff:accept:${applicantId}` },
        { type: 2, style: 4, label: 'Denied', custom_id: `application:staff:deny:${applicantId}` },
      ] }],
    };
    await discordCreateMessage(channel, message);
    return NextResponse.json({ message: 'Application submitted successfully.' });
  } catch (error) {
    console.error('[STAFF APPLICATION]', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to submit application.' }, { status: 500 });
  }
}
