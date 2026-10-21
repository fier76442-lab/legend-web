import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { discordCreateMessage } from '@/lib/discord';

export async function POST(req: Request) {
  try {
    const secret = process.env.SESSION_SECRET;
    const cookie = (await cookies()).get('legend_discord_session')?.value;
    if (!secret || !cookie) return NextResponse.json({ message: 'Sign in with Discord before submitting your gang application.' }, { status: 401 });
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret));
    const applicantId = String(payload.discordId || '');
    const guild = process.env.DISCORD_GUILD_ID;
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!applicantId || !guild || !token) return NextResponse.json({ message: 'Discord server configuration is missing.' }, { status: 500 });
    const data = await req.json();
    const gangName = String(data.gangName || '').trim().slice(0, 100);
    const originStory = String(data.originStory || '').trim().slice(0, 1000);
    const objective = String(data.objective || '').trim().slice(0, 1000);
    const color = /^#[0-9a-fA-F]{6}$/.test(String(data.color)) ? String(data.color) : '#FF7A1A';
    const memberIds = Array.isArray(data.memberIds) ? [...new Set(data.memberIds.map((x: unknown) => String(x).trim()).filter((x: string) => /^\d{17,20}$/.test(x)))] as string[] : [];
    if (!gangName || originStory.length < 10 || objective.length < 10 || data.rulesAccepted !== true) return NextResponse.json({ message: 'Complete every required field and accept the server rules.' }, { status: 400 });
    if (memberIds.length < 8) return NextResponse.json({ message: `At least 8 unique valid Discord IDs are required. Currently: ${memberIds.length}/8.` }, { status: 400 });
    const requester = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${applicantId}`, { headers: { Authorization: `Bot ${token}` }, cache: 'no-store' });
    if (!requester.ok) return NextResponse.json({ message: 'Your Discord account must be a member of the server.' }, { status: 403 });
    const requesterMember = await requester.json();
    const whitelistRole = process.env.DISCORD_WHITELISTED_ROLE_ID;
    if (whitelistRole && !(requesterMember.roles || []).includes(whitelistRole)) return NextResponse.json({ message: 'Whitelist is required before applying for a gang.' }, { status: 403 });
    const verified: string[] = [];
    for (const id of memberIds) {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${id}`, { headers: { Authorization: `Bot ${token}` }, cache: 'no-store' });
      if (response.ok) verified.push(id);
    }
    if (verified.length < 8) return NextResponse.json({ message: `Only ${verified.length}/8 members could be verified in the Discord server. Check the IDs and try again.` }, { status: 400 });
    const channel = process.env.DISCORD_GANG_REVIEW_CHANNEL_ID || process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID;
    if (!channel) return NextResponse.json({ message: 'Gang review channel is not configured. Set DISCORD_GANG_REVIEW_CHANNEL_ID in .env.' }, { status: 500 });
    const memberMentions = verified.map(id => `<@${id}>`).join(', ');
    const color2 = data.twoColors && /^#[0-9a-fA-F]{6}$/.test(String(data.secondColor)) ? String(data.secondColor) : '';
    await discordCreateMessage(channel, { embeds: [{ title: 'New Gang & Family Application', color: parseInt(color.slice(1), 16), description: [
      `**Applicant:** <@${applicantId}> (\`${applicantId}\`)`, `**Gang name:** ${gangName}`, `**Accent color:** ${color}${color2 ? ` / ${color2}` : ''}`, `**Verified members (${verified.length}):** ${memberMentions}`,
      `**Origin story:**\n${originStory}`, `**Objective:**\n${objective}`, '**Rules accepted:** Yes',
    ].join('\n\n').slice(0, 5900), timestamp: new Date().toISOString(), footer: { text: `gang_application; applicant=${applicantId}` } }] });
    return NextResponse.json({ message: `Gang application submitted successfully. ${verified.length} Discord members verified; staff have been notified.` });
  } catch (error) {
    console.error('[GANG APPLICATION]', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to submit application.' }, { status: 500 });
  }
}
