import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const ROLE_IDS = {
  owner: '1559253919073308693',
  coOwner: '1559253927617237012',
  developer: '1559253934923714640',
  staff: ['1559253919073308693','1559253927617237012','1559253934923714640','1559253939243847700','1559253969023533267','1559253977030205450','1559253985418805312','1559253989583884399','1559254002099687546','1559254006696640572','1559254015005433947','1559254019598327809'],
};
export async function GET(request: Request) {
  try {
    const secret = process.env.SESSION_SECRET;
    const cookie = (await cookies()).get('legend_discord_session')?.value;
    if (!secret || !cookie) return NextResponse.json({ allowed: false, leadership: false, reason: 'Connect to Discord first.' }, { status: 401 });
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret));
    const id = String(payload.discordId || '');
    const guild = process.env.DISCORD_GUILD_ID, token = process.env.DISCORD_BOT_TOKEN;
    if (!id || !guild || !token) return NextResponse.json({ allowed: false, leadership: false, reason: 'Discord server configuration is missing.' }, { status: 500 });
    const r = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${id}`, { headers: { Authorization: `Bot ${token}` }, cache: 'no-store' });
    if (!r.ok) {
      console.error('[STAFF ACCESS] Discord API status:', r.status);
      return NextResponse.json({ allowed: false, leadership: false, reason: 'Could not verify your Discord roles.' }, { status: 403 });
    }
    const member = await r.json();
    const roles: string[] = Array.isArray(member.roles) ? member.roles : [];
    const leadership = [ROLE_IDS.owner, ROLE_IDS.coOwner, ROLE_IDS.developer].some(role => roles.includes(role));
    const allowed = roles.some(role => ROLE_IDS.staff.includes(role) || role === (process.env.DISCORD_WHITELISTER_ROLE_ID || ''));
    const scope = new URL(request.url).searchParams.get('scope');
    if (scope === 'leadership' && !leadership) return NextResponse.json({ allowed: false, leadership: false, reason: 'Owner, Co Owner or Developer access required.' }, { status: 403 });
    return NextResponse.json({ allowed, leadership, discordId: id }, { status: allowed ? 200 : 403 });
  } catch {
    return NextResponse.json({ allowed: false, leadership: false, reason: 'Your Discord session expired. Sign in again.' }, { status: 401 });
  }
}
