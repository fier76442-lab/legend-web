import { NextResponse } from 'next/server';

const STAFF_ROLES = [
  { name: 'Owner', id: '1559253919073308693', group: 'Owners' },
  { name: 'Co Owner', id: '1559253927617237012', group: 'Owners' },
  { name: 'Devlopper', id: '1559253934923714640', group: 'Management' },
  { name: 'Supervisor', id: '1559253939243847700', group: 'Management' },
  { name: 'Head Admin', id: '1559253977030205450', group: 'High Staff' },
  { name: 'Head Checker', id: '1559253989583884399', group: 'High Staff' },
  { name: 'Head Whitelisted', id: '1559253985418805312', group: 'High Staff' },
  { name: 'Admin', id: '1559254002099687546', group: 'Staffs' },
  { name: 'Moderator', id: '1559254006696640572', group: 'Staffs' },
  { name: 'Whitelister', id: process.env.DISCORD_WHITELISTER_ROLE_ID || '', group: 'Staffs' },
  { name: 'PC Checker', id: '1559254015005433947', group: 'Staffs' },
  { name: 'Support Team', id: '1559254019598327809', group: 'Staffs' },
] as const;

type Member = {
  user: { id: string; username: string; global_name?: string | null; avatar?: string | null };
  nick?: string | null;
  roles: string[];
};

async function discordFetch<T>(url: string): Promise<T> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN is missing');
  const r = await fetch(`https://discord.com/api/v10${url}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Discord API ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

export async function GET() {
  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) throw new Error('DISCORD_GUILD_ID is missing');

    const members: Member[] = [];
    let after = '0';
    while (true) {
      const batch = await discordFetch<Member[]>(`/guilds/${guildId}/members?limit=1000&after=${after}`);
      members.push(...batch);
      if (batch.length < 1000) break;
      after = batch[batch.length - 1].user.id;
    }

    const staff = members.flatMap((member) => {
      const matched = STAFF_ROLES.filter((role) => role.id && member.roles.includes(role.id));
      return matched.map((role) => ({
        id: member.user.id,
        username: member.user.username,
        displayName: member.nick || member.user.global_name || member.user.username,
        avatar: member.user.avatar
          ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=256`
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(member.user.id) % 5n)}.png`,
        rank: role.name,
        group: role.group,
      }));
    });

    const rankOrder = new Map(STAFF_ROLES.map((r, i) => [r.name, i]));
    staff.sort((a, b) => (rankOrder.get(a.rank) ?? 999) - (rankOrder.get(b.rank) ?? 999));

    return NextResponse.json({ staff, roles: STAFF_ROLES }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[STAFF API]', error);
    return NextResponse.json({
      staff: [],
      error: error instanceof Error ? error.message : 'Unable to load Discord staff',
    }, { status: 500 });
  }
}
