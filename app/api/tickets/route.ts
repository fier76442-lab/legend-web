import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const TYPES = ['General Support','Donation','Ban Appeal','Refund','Partnership','Contact Developer','High Rank','Other'];
const LOG_CHANNEL = process.env.DISCORD_TICKET_LOG_CHANNEL_ID || '1559255890006245497';
const LEADERSHIP = ['1559253919073308693','1559253927617237012','1559253934923714640'];
const STAFF = [...LEADERSHIP,'1559253939243847700','1559253969023533267','1559253977030205450','1559253985418805312','1559253989583884399','1559254002099687546','1559254006696640572','1559254015005433947','1559254019598327809'];

async function auth(requireStaff = true) {
  const secret = process.env.SESSION_SECRET;
  const cookie = (await cookies()).get('legend_discord_session')?.value;
  if (!secret || !cookie) throw Object.assign(new Error('Sign in with Discord first.'), { status: 401 });
  const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret));
  const id = String(payload.discordId || '');
  const guild = process.env.DISCORD_GUILD_ID, token = process.env.DISCORD_BOT_TOKEN;
  if (!id || !guild || !token) throw Object.assign(new Error('Discord configuration is missing.'), { status: 500 });
  const m = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${id}`, { headers: { Authorization: `Bot ${token}` }, cache: 'no-store' });
  if (!m.ok) throw Object.assign(new Error('Could not verify Discord membership.'), { status: 403 });
  const member = await m.json();
  if (requireStaff && !(member.roles || []).some((r: string) => STAFF.includes(r) || r === (process.env.DISCORD_WHITELISTER_ROLE_ID || ''))) {
    throw Object.assign(new Error('Staff access required.'), { status: 403 });
  }
  return { id, guild, token, roles: member.roles as string[] };
}
async function discord(path: string, token: string, method = 'GET', body?: unknown) {
  const r = await fetch(`https://discord.com/api/v10${path}`, {
    method, headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Discord API ${r.status}: ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const mineOnly = params.get('mine') === '1';
    const conversationId = params.get('conversation');
    const { token, id, roles } = await auth(false);
    const isStaff = roles.some((r: string) => STAFF.includes(r) || r === (process.env.DISCORD_WHITELISTER_ROLE_ID || ''));
    if (conversationId) {
      if (!/^\d{17,20}$/.test(conversationId)) return NextResponse.json({ message: 'Invalid ticket.' }, { status: 400 });
      const logMessage: any = await discord(`/channels/${LOG_CHANNEL}/messages/${conversationId}`, token);
      const ticketEmbed = (logMessage.embeds || []).find((e: any) => String(e.title || '').startsWith('Ticket •'));
      if (!ticketEmbed) return NextResponse.json({ message: 'Ticket not found.' }, { status: 404 });
      const footer = String(ticketEmbed.footer?.text || '');
      const ownerId = footer.match(/opened_by=(\d{17,20})/)?.[1] || '';
      const threadId = footer.match(/thread_id=(\d{17,20})/)?.[1] || '';
      if (ownerId !== id && !isStaff) return NextResponse.json({ message: 'You cannot view this ticket.' }, { status: 403 });
      if (!threadId) return NextResponse.json({ messages: [], threadId: '' });
      const threadMessages: any = await discord(`/channels/${threadId}/messages?limit=100`, token);
      const conversation = await Promise.all((threadMessages || []).slice().reverse().map(async (m: any) => {
        let author = m.member?.nick || m.author?.global_name || m.author?.username || 'User';
        let authorId = m.author?.id || '';
        let content = String(m.content || '');
        // Website replies are posted by the bot to Discord, so recover the real
        // Discord user's name from the attribution prefix instead of showing the bot name.
        const websiteReply = content.match(/^\*\*Website reply from <@!?([0-9]{17,20})>:\*\*\s*\n?/);
        const openedBy = content.match(/^\*\*Ticket opened by <@!?([0-9]{17,20})>\*\*\s*\n?/);
        const attributedId = websiteReply?.[1] || openedBy?.[1];
        if (attributedId) {
          authorId = attributedId;
          content = content.replace(websiteReply || openedBy, '').trim();
          try {
            const profile: any = await discord(`/guilds/${guild}/members/${attributedId}`, token);
            author = profile.nick || profile.user?.global_name || profile.user?.username || 'Discord User';
          } catch { author = 'Discord User'; }
        }
        return {
          id: m.id, author, authorId,
          avatar: m.author?.avatar && m.author?.id ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png` : '',
          content, createdAt: m.timestamp, isBot: Boolean(m.author?.bot) && !attributedId,
        };
      }));
      return NextResponse.json({ messages: conversation, threadId, isStaff, ownerId });
    }
    const messages: any = await discord(`/channels/${LOG_CHANNEL}/messages?limit=50`, token);
    const tickets = (messages || []).filter((m: any) => (m.embeds || []).some((e: any) => String(e.title || '').startsWith('Ticket •')))
      .map((m: any) => {
        const e = m.embeds.find((x: any) => String(x.title || '').startsWith('Ticket •'));
        const footer = String(e.footer?.text || '');
        const threadId = footer.match(/thread_id=(\d{17,20})/)?.[1] || '';
        return { id: m.id, threadId, title: String(e.title || 'Ticket'), description: String(e.description || ''),
          status: footer.includes('status=closed') ? 'closed' : 'open', claimedBy: footer.match(/claimed_by=(\d{17,20})/)?.[1] || '',
          replyCount: Number(footer.match(/replies=(\d+)/)?.[1] || 0), openedBy: footer.match(/opened_by=(\d{17,20})/)?.[1] || '',
          createdAt: m.timestamp, author: m.author?.username || 'Ticket system' };
      }).filter((t: any) => !mineOnly || t.openedBy === id);
    return NextResponse.json({ tickets });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not load tickets.' }, { status: e.status || 500 });
  }
}
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let data: any;
    let uploadedFile: File | null = null;
    if (contentType.includes('multipart/form-data')) { const form = await req.formData(); data = Object.fromEntries(form.entries()); const f = form.get('attachment'); uploadedFile = f instanceof File && f.size ? f : null; } else data = await req.json();
    const action = String(data.action || 'open');
    const { id, guild, token, roles } = await auth(['claim', 'close', 'reopen'].includes(action));
    if (action === 'open') {
      const type = String(data.type || ''), subject = String(data.subject || '').trim().slice(0, 150), details = String(data.details || '').trim().slice(0, 2500);
      if (!TYPES.includes(type) || !subject || !details) return NextResponse.json({ message: 'Complete all ticket fields.' }, { status: 400 });
      // Enforce the three-open-ticket limit on the server.
      const recent: any = await discord(`/channels/${LOG_CHANNEL}/messages?limit=100`, token);
      const openCount = (recent || []).filter((msg: any) => {
        const embed = (msg.embeds || []).find((e: any) => String(e.title || '').startsWith('Ticket •'));
        if (!embed) return false;
        const footer = String(embed.footer?.text || '');
        return footer.includes(`opened_by=${id}`) && /(?:^|;\s*)status=open(?:;|$)/.test(footer);
      }).length;
      if (openCount >= 3) return NextResponse.json({ message: 'You already have 3 open tickets. Wait for staff to close one before opening another.' }, { status: 429 });
      const channelMessage: any = await discord(`/channels/${LOG_CHANNEL}/messages`, token, 'POST', { embeds: [{
        title: `Ticket • ${type}`, description: `**Opened By**\n<@${id}>\n\n**Claimed**\nNo · Waiting for staff\n\n**Description**\n${details}`,
        fields: [{ name: 'Subject', value: subject.slice(0, 1024), inline: false }, { name: 'Claimed', value: 'No', inline: true }, { name: 'Status', value: 'OPEN', inline: true }],
        color: 15548997, timestamp: new Date().toISOString(), footer: { text: `status=open; opened_by=${id}` }
      }] });
      let thread: any;
      try {
        thread = await discord(`/channels/${LOG_CHANNEL}/messages/${channelMessage.id}/threads`, token, 'POST', { name: `ticket-${type.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0,35)}-${id.slice(-4)}`, auto_archive_duration: 1440 });
        await discord(`/channels/${thread.id}/messages`, token, 'POST', { content: `**Ticket opened by <@${id}>**\n**Subject:** ${subject}\n**Department:** ${type}\n\n${details}` });
        const e = channelMessage.embeds?.[0] || { title: `Ticket • ${type}`, description: subject, color: 15548997 };
        e.footer = { text: `status=open; opened_by=${id}; thread_id=${thread.id}; replies=0` };
        await discord(`/channels/${LOG_CHANNEL}/messages/${channelMessage.id}`, token, 'PATCH', { embeds: [e] });
      } catch (err) { console.error('[TICKET THREAD]', err); }
      return NextResponse.json({ message: 'Ticket opened. Staff have been notified.', ticketId: channelMessage.id, threadId: thread?.id || '', threadUrl: thread?.id ? `https://discord.com/channels/${guild}/${thread.id}` : '' });
    }
    const ticketId = String(data.ticketId || ''), threadId = String(data.threadId || '');
    if (!/^\d{17,20}$/.test(ticketId)) return NextResponse.json({ message: 'Invalid ticket.' }, { status: 400 });
    const original: any = await discord(`/channels/${LOG_CHANNEL}/messages/${ticketId}`, token);
    const embed = original.embeds?.find((e: any) => String(e.title || '').startsWith('Ticket •'));
    if (!embed) return NextResponse.json({ message: 'Ticket not found.' }, { status: 404 });
    const oldFooter = String(embed.footer?.text || '');
    const ownerId = oldFooter.match(/opened_by=(\d{17,20})/)?.[1] || '';
    const isStaff = roles.some((r: string) => STAFF.includes(r) || r === (process.env.DISCORD_WHITELISTER_ROLE_ID || ''));
    if (action === 'reply' && ownerId !== id && !isStaff) return NextResponse.json({ message: 'You cannot reply to this ticket.' }, { status: 403 });
    if (['claim', 'close', 'reopen'].includes(action) && !isStaff) return NextResponse.json({ message: 'Staff access required.' }, { status: 403 });
    const actualThread = threadId || oldFooter.match(/thread_id=(\d{17,20})/)?.[1] || '';
    if (action === 'claim') {
      if (!actualThread) throw new Error('Ticket thread is missing. Check bot permissions.');
      await discord(`/channels/${actualThread}/messages`, token, 'POST', { content: `🟡 Ticket claimed by <@${id}>.` });
      embed.footer = { text: oldFooter.replace(/claimed_by=\d{17,20}/, '').replace(/; ?$/, '') + `; claimed_by=${id}` };
      embed.description = String(embed.description || '').replace(/\*\*Claimed\*\*\n[^\n]+/, `**Claimed**\n<@${id}>`);
      embed.fields = (embed.fields || []).map((f: any) => f.name === 'Claimed' ? { ...f, value: `<@${id}>` } : f);
      await discord(`/channels/${LOG_CHANNEL}/messages/${ticketId}`, token, 'PATCH', { embeds: [embed] });
    } else if (action === 'reply') {
      const message = String(data.message || '').trim().slice(0, 1800);
      if (!message && !uploadedFile) return NextResponse.json({ message: 'Write a message or attach a file first.' }, { status: 400 });
      if (!actualThread) throw new Error('Ticket thread is missing. Check bot permissions.');
      if (uploadedFile) {
        if (uploadedFile.size > 8 * 1024 * 1024) return NextResponse.json({ message: 'File must be 8 MB or smaller.' }, { status: 413 });
        const form = new FormData();
        form.set('payload_json', JSON.stringify({ content: `**Website reply from <@${id}>:**\n${message || `📎 ${uploadedFile.name}`}` }));
        form.set('files[0]', uploadedFile, uploadedFile.name);
        const upload = await fetch(`https://discord.com/api/v10/channels/${actualThread}/messages`, { method: 'POST', headers: { Authorization: `Bot ${token}` }, body: form, cache: 'no-store' });
        if (!upload.ok) throw new Error(`Discord file upload failed (${upload.status}): ${await upload.text()}`);
      } else {
        await discord(`/channels/${actualThread}/messages`, token, 'POST', { content: `**Website reply from <@${id}>:**\n${message}` });
      }
      const currentReplies = Number(oldFooter.match(/replies=(\d+)/)?.[1] || 0) + 1;
      embed.footer = { text: oldFooter.match(/replies=\d+/) ? oldFooter.replace(/replies=\d+/, `replies=${currentReplies}`) : `${oldFooter}; replies=${currentReplies}` };
      await discord(`/channels/${LOG_CHANNEL}/messages/${ticketId}`, token, 'PATCH', { embeds: [embed] });
    } else if (action === 'close' || action === 'reopen') {
      const closing = action === 'close';
      if (actualThread) {
        await discord(`/channels/${actualThread}`, token, 'PATCH', { archived: closing, locked: closing });
        if (!closing) await discord(`/channels/${actualThread}`, token, 'PATCH', { archived: false, locked: false });
        else await discord(`/channels/${actualThread}/messages`, token, 'POST', { content: `🔒 Ticket closed by <@${id}>.` }).catch(() => null);
      }
      if (closing) {
        // Closing removes the ticket from the active queue and deletes its thread.
        // A separate audit log is created below before the original ticket card is removed.
        if (actualThread) await discord(`/channels/${actualThread}`, token, 'DELETE').catch((err: unknown) => console.error('[TICKET THREAD DELETE]', err));
        await discord(`/channels/${LOG_CHANNEL}/messages/${ticketId}`, token, 'DELETE');
      } else {
        embed.footer = { text: oldFooter.replace(/status=(open|closed)/, 'status=open') };
        await discord(`/channels/${LOG_CHANNEL}/messages/${ticketId}`, token, 'PATCH', { embeds: [embed] });
      }
    } else return NextResponse.json({ message: 'Unknown ticket action.' }, { status: 400 });
    await discord(`/channels/${LOG_CHANNEL}/messages`, token, 'POST', { embeds: [{
      title: `Ticket ${action.toUpperCase()}`, description: `**Ticket:** ${ticketId}\n**Staff:** <@${id}> (\`${id}\`)`,
      color: action === 'close' ? 9807270 : action === 'claim' ? 16753920 : 15548997,
      timestamp: new Date().toISOString()
    }] }).catch((err: unknown) => console.error('[TICKET AUDIT LOG]', err));
    return NextResponse.json({ message: `Ticket ${action} successful.` });
  } catch (e: any) {
    console.error('[TICKET CENTER]', e);
    return NextResponse.json({ message: e.message || 'Ticket action failed.' }, { status: e.status || 500 });
  }
}
