import { NextResponse } from 'next/server';
import { createPublicKey, verify as verifySignature } from 'node:crypto';

export const runtime = 'nodejs';

const STAFF_REVIEW_ROLES = [
  '1562845546853441556', '1562845556337016952', '1562845563525926952',
  '1562845571662745601', '1562845567611310130', '1562845588637225123',
  '1562845634736824420', '1562845638884855818', '1562845660640841729',
  '1562875050971893900', '1562845664042553477', '1562874969162256490',
  '1562845668303704074', '1562845673311965354', '1562845680857251943',
];
const ROLE_WHITELISTED = ['1562845857215291524', '1562845861061599372'];
const ROLE_STAFF = '1562845710947188848';

function verifyDiscordRequest(rawBody: string, signature: string | null, timestamp: string | null) {
  const hex = process.env.DISCORD_PUBLIC_KEY;
  if (!hex || !signature || !timestamp || !/^[0-9a-f]{128}$/i.test(signature) || !/^[0-9a-f]{64}$/i.test(hex)) return false;
  // Discord publishes a raw 32-byte Ed25519 public key. Wrap it in the standard SPKI DER header.
  const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(hex, 'hex')]);
  const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
  return verifySignature(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, 'hex'));
}

async function discord(path: string, method = 'GET', body?: unknown) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN is missing');
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Discord API ${response.status}: ${data?.message || 'request failed'}`);
  return data;
}

function modal(kind: string, applicantId: string, channelId: string, messageId: string) {
  return {
    type: 9,
    data: {
      custom_id: `application:${kind}:deny_reason:${applicantId}:${channelId}:${messageId}`,
      title: 'Reject application',
      components: [{ type: 1, components: [{ type: 4, custom_id: 'reason', label: 'Reason for rejection', style: 2, min_length: 3, max_length: 800, required: true, placeholder: 'Explain why this application was rejected' }] }],
    },
  };
}

async function sendResult(channel: string, content: string) {
  await discord(`/channels/${channel}/messages`, 'POST', { content, allowed_mentions: { parse: [], users: [...content.matchAll(/<@(\d{17,20})>/g)].map((m) => m[1]) } });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyDiscordRequest(rawBody, request.headers.get('x-signature-ed25519'), request.headers.get('x-signature-timestamp'))) {
    return NextResponse.json({ error: 'Invalid Discord request signature.' }, { status: 401 });
  }

  let interaction: any;
  try { interaction = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (interaction.type === 1) return NextResponse.json({ type: 1 });
  if (interaction.type !== 3 && interaction.type !== 5) return NextResponse.json({ type: 4, data: { content: 'Unsupported interaction.', flags: 64 } });

  try {
    const guild = process.env.DISCORD_GUILD_ID;
    if (!guild || interaction.guild_id !== guild) return NextResponse.json({ type: 4, data: { content: 'This action is not available in this server.', flags: 64 } });
    const actorRoles: string[] = interaction.member?.roles || [];
    if (!actorRoles.some((role) => STAFF_REVIEW_ROLES.includes(role))) return NextResponse.json({ type: 4, data: { content: 'You do not have permission to review applications.', flags: 64 } });

    const customId: string = interaction.data?.custom_id || '';
    const match = /^application:(whitelist|gang|staff):(accept|deny|deny_reason):(\d{17,20})(?::(\d{17,20}):(\d{17,20}))?$/.exec(customId);
    if (!match) return NextResponse.json({ type: 4, data: { content: 'Unknown application action.', flags: 64 } });
    const [, kind, action, applicantId, modalChannelId, modalMessageId] = match;
    if (action === 'deny' && interaction.type === 3) return NextResponse.json(modal(kind, applicantId, String(interaction.channel_id), String(interaction.message?.id || '')));

    const guildMember = await discord(`/guilds/${guild}/members/${applicantId}`) as any;
    if (!guildMember?.user?.id) return NextResponse.json({ type: 4, data: { content: 'Applicant is no longer in this Discord server.', flags: 64 } });

    const isAccept = action === 'accept';
    let reason = '';
    if (!isAccept) {
      reason = String(interaction.data?.components?.[0]?.components?.[0]?.value || '').trim();
      if (reason.length < 3) return NextResponse.json({ type: 4, data: { content: 'Please provide a rejection reason.', flags: 64 } });
    }

    if (isAccept && kind === 'whitelist') {
      for (const roleId of ROLE_WHITELISTED) await discord(`/guilds/${guild}/members/${applicantId}/roles/${roleId}`, 'PUT');
    }
    if (isAccept && kind === 'staff') await discord(`/guilds/${guild}/members/${applicantId}/roles/${ROLE_STAFF}`, 'PUT');

    const reviewChannel = String(modalChannelId || interaction.channel_id || '');
    const reviewMessageId = String(modalMessageId || interaction.message?.id || '');
    const resultChannel = kind === 'whitelist'
      ? (process.env.DISCORD_WHITELIST_RESULT_CHANNEL_ID || '1562847770069434378')
      : kind === 'staff'
        ? (process.env.DISCORD_STAFF_RESULT_CHANNEL_ID || '1562847887497633893')
        : (process.env.DISCORD_GANG_RESULT_CHANNEL_ID || reviewChannel);

    let result = '';
    if (kind === 'whitelist' && isAccept) {
      result = `<@${applicantId}> Your Whitelist Application has been accepted [✅](https://canary.discord.com/assets/43b7ead1fb91b731.svg) Welcome aboard! ,see you in the interview [💕](https://canary.discord.com/assets/ed873f7a2220bab9.svg) !`;
    } else if (kind === 'whitelist') {
      result = `Sorry.. But Your Whitelist application has been rejected.\nreason : ${reason}`;
    } else if (kind === 'staff') {
      result = isAccept ? `<@${applicantId}> Your Staff Application has been accepted! Welcome to the DarkCity RolePlay Staff Team.` : `<@${applicantId}> Your Staff Application has been rejected.\nReason: ${reason}`;
    } else {
      result = isAccept ? `<@${applicantId}> Your Gang Application has been accepted!` : `<@${applicantId}> Your Gang Application has been rejected.\nReason: ${reason}`;
    }
    await sendResult(resultChannel, result);

    let updatedMessage = interaction.message;
    if (!updatedMessage && reviewMessageId) {
      updatedMessage = await discord(`/channels/${reviewChannel}/messages/${reviewMessageId}`) as any;
    }
    const embed = updatedMessage?.embeds?.[0];
    const updatedEmbed = embed ? { ...embed, title: `${embed.title || `${kind} application`} — ${isAccept ? 'ACCEPTED' : 'REJECTED'}`, color: isAccept ? 5763719 : 15548997, description: `${embed.description || ''}${isAccept ? '' : `\n\n**Rejection reason:** ${reason}`}`.slice(0, 4000), footer: { text: `Reviewed by ${interaction.member?.user?.username || interaction.user?.username || 'staff'} • ${new Date().toISOString()}` } } : undefined;
    const edit = { content: `${updatedMessage?.content || ''}\n\n${isAccept ? '✅ ACCEPTED' : '❌ REJECTED'} by <@${interaction.member?.user?.id || interaction.user?.id}>`, embeds: updatedEmbed ? [updatedEmbed] : [], components: [] };
    if (reviewMessageId) await discord(`/channels/${reviewChannel}/messages/${reviewMessageId}`, 'PATCH', edit);
    return NextResponse.json({ type: 4, data: { content: `Application ${isAccept ? 'accepted' : 'rejected'} and result message sent.`, flags: 64 } });
  } catch (error) {
    console.error('[DISCORD INTERACTIONS]', error);
    return NextResponse.json({ type: 4, data: { content: 'Could not process this application. Check the server logs and bot permissions.', flags: 64 } });
  }
}
