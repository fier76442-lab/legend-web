import { NextResponse } from 'next/server';

const STREAMER_ROLE_ID = '1559254039797964871';
type Member = { user: { id: string; username: string; global_name?: string | null; avatar?: string | null }; nick?: string | null; roles: string[] };
export async function GET() {
  try {
    const guild = process.env.DISCORD_GUILD_ID;
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!guild || !token) throw new Error('Discord server configuration is missing.');
    const members: Member[] = [];
    let after = '0';
    while (true) {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guild}/members?limit=1000&after=${after}`, {
        headers: { Authorization: `Bot ${token}` }, cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Discord API ${response.status}`);
      const batch = await response.json() as Member[];
      members.push(...batch);
      if (batch.length < 1000) break;
      after = batch[batch.length - 1].user.id;
    }
    const streamers = members.filter(member => member.roles?.includes(STREAMER_ROLE_ID)).map(member => ({
      id: member.user.id,
      username: member.user.username,
      displayName: member.nick || member.user.global_name || member.user.username,
      avatar: member.user.avatar
        ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.${member.user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(member.user.id) % BigInt(5))}.png`,
    }));
    streamers.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ streamers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[STREAMERS API]', error);
    return NextResponse.json({ streamers: [], error: error instanceof Error ? error.message : 'Could not load streamers.' }, { status: 500 });
  }
}
