require('dotenv').config();
const {Client,GatewayIntentBits,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle} = require('discord.js');
const client = new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildModeration,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildInvites,GatewayIntentBits.GuildEmojisAndStickers]});
const token=process.env.DISCORD_BOT_TOKEN;
const resultWhitelist=process.env.DISCORD_WHITELIST_RESULT_CHANNEL_ID || '1559255730479964202';
const resultStaff=process.env.DISCORD_STAFF_RESULT_CHANNEL_ID;

client.on('interactionCreate', async interaction => {
  try {
    if (!interaction.isButton()) return;
    if (!interaction.customId.endsWith('_accept') && !interaction.customId.endsWith('_deny')) return;

    const type = interaction.customId.startsWith('whitelist_') ? 'whitelist' : 'staff';
    const denied = interaction.customId.endsWith('_deny');
    const modal = new ModalBuilder()
      .setCustomId(`decision:${type}:${denied ? 'deny' : 'accept'}:${interaction.message.id}`)
      .setTitle(denied ? 'Reject Application' : 'Accept Application');
    const reason = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel(denied ? 'Reason for rejection' : 'Reason / note (required)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder(denied ? 'Write the reason...' : 'Write a short note...');
    modal.addComponents(new ActionRowBuilder().addComponents(reason));
    await interaction.showModal(modal);
  } catch (error) {
    console.error('[APPLICATION BUTTON]', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Could not open the decision form. Check that the bot is online and updated.', ephemeral: true }).catch(() => {});
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith('decision:')) return;
  // Acknowledge immediately so Discord never shows "The application did not respond" while API calls run.
  await interaction.deferReply({ ephemeral: true }).catch(error => console.error('[DECISION DEFER]', error));
  try {
    const [, type, decision, originalMessageId] = interaction.customId.split(':');
    const reason = interaction.fields.getTextInputValue('reason');
    const channelId = type === 'whitelist'
      ? (process.env.DISCORD_WHITELIST_RESULT_CHANNEL_ID || '1559255730479964202')
      : (process.env.DISCORD_STAFF_RESULT_CHANNEL_ID || process.env.DISCORD_STAFF_REVIEW_CHANNEL_ID);
    if (!channelId) return interaction.editReply({ content: 'Result channel is not configured. Set DISCORD_STAFF_RESULT_CHANNEL_ID in the bot environment.' });

    const reviewChannel = await client.channels.fetch(interaction.channelId).catch(() => null);
    const original = reviewChannel && 'messages' in reviewChannel
      ? await reviewChannel.messages.fetch(originalMessageId).catch(() => null)
      : null;
    const applicant = original?.embeds?.[0]?.footer?.text || '';
    if (!/^\d{17,20}$/.test(applicant)) {
      return interaction.editReply({ content: 'Applicant Discord ID is missing from this application. Update the website code and submit a new application.' });
    }

    const resultChannel = await client.channels.fetch(channelId).catch(() => null);
    if (!resultChannel || !resultChannel.isTextBased()) {
      return interaction.editReply({ content: `I cannot access the result channel (${channelId}). Check the channel ID and bot permissions.` });
    }

    let message;
    if (type === 'whitelist') {
      message = decision === 'accept'
        ? `<@${applicant}> Your Whitelist Application has been accepted ✅ Welcome aboard! See you in the interview!\nNote: ${reason}`
        : `<@${applicant}> Sorry, your Whitelist Application has been rejected.\nReason: ${reason}`;
    } else {
      message = decision === 'accept'
        ? `<@${applicant}> Your Staff Application has been accepted ✅ The staff team will contact you with the next steps.\nNote: ${reason}`
        : `<@${applicant}> Sorry, your Staff Application has been rejected.\nReason: ${reason}`;
    }
    await resultChannel.send({ content: message });
    await interaction.editReply({ content: `Application ${decision === 'accept' ? 'accepted' : 'rejected'} and result sent successfully.` });
  } catch (error) {
    console.error('[APPLICATION DECISION]', error);
    await interaction.editReply({ content: `Decision failed: ${error instanceof Error ? error.message : 'unknown error'}` }).catch(() => {});
  }
});

// Detailed server audit logs. Each event gets its own named embed in the configured log channel.
const LOG_CHANNEL = process.env.DISCORD_AUDIT_LOG_CHANNEL_ID || process.env.DISCORD_STAFF_LOG_CHANNEL_ID || '1559255890006245497';
const { EmbedBuilder, AuditLogEvent } = require('discord.js');
async function audit(title, description, color = 0xED1C24) {
  try {
    const channel = await client.channels.fetch(LOG_CHANNEL).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(String(description || 'No extra details').slice(0,3900)).setTimestamp()] });
  } catch (e) { console.error('[AUDIT LOG]', title, e.message); }
}
const tag = u => u ? `${u.tag || u.username} (ID: ${u.id})` : 'Unknown';
client.on('guildMemberAdd', m => audit('Member Joined', `${tag(m.user)} joined the server.` ,0x57F287));
client.on('guildMemberRemove', async m => {
  let action='Member Left', extra='';
  try { const logs=await m.guild.fetchAuditLogs({limit:5}); const entry=logs.entries.find(e=>e.target?.id===m.id && Date.now()-e.createdTimestamp<10000); if(entry?.action===AuditLogEvent.MemberKick){action='Member Kicked';extra=`\nBy: ${tag(entry.executor)}\nReason: ${entry.reason||'No reason provided'}`;} else if(entry?.action===AuditLogEvent.MemberBanAdd){action='Member Banned';extra=`\nBy: ${tag(entry.executor)}\nReason: ${entry.reason||'No reason provided'}`;} }catch{}
  audit(action,`${tag(m.user)} left the server.${extra}`,0xED1C24);
});
client.on('guildBanAdd', b=>audit('Member Banned',`${tag(b.user)} was banned.`,0xED1C24));
client.on('guildBanRemove', b=>audit('Member Unbanned',`${tag(b.user)} was unbanned.`,0x57F287));
client.on('guildMemberUpdate',(before,after)=>{
 const a=before.roles.cache, b=after.roles.cache;
 for(const [id,role] of b) if(!a.has(id)) audit('Role Given',`${tag(after.user)} received **${role.name}** (ID: ${id}).`);
 for(const [id,role] of a) if(!b.has(id)) audit('Role Removed',`${tag(after.user)} lost **${role.name}** (ID: ${id}).`);
 if(before.nickname!==after.nickname) audit('Nickname Changed',`${tag(after.user)}: **${before.nickname||before.user.username}** → **${after.nickname||after.user.username}**`);
 if(!before.communicationDisabledUntilTimestamp && after.communicationDisabledUntilTimestamp) audit('Member Timeout',`${tag(after.user)} timed out until ${new Date(after.communicationDisabledUntilTimestamp).toISOString()}.`);
});
client.on('messageDelete',m=>{if(m.guild)audit('Message Deleted',`Author: ${tag(m.author)}\nChannel: <#${m.channelId}>\nContent: ${m.content||'[No cached content]'}`)});
client.on('messageDeleteBulk',(msgs,channel)=>audit('Messages Deleted',`${msgs.size} messages deleted in <#${channel.id}>.`));
client.on('messageUpdate',(before,after)=>{if(after.guild && before.content!==after.content)audit('Message Edited',`Author: ${tag(after.author)}\nChannel: <#${after.channelId}>\nBefore: ${before.content||'[empty]'}\nAfter: ${after.content||'[empty]'}`)});
client.on('channelCreate',c=>audit(c.isThread()?'Thread Created':'Channel Created',`${c.name} (ID: ${c.id})`));
client.on('channelUpdate',(a,b)=>{ audit(b.isThread()?'Thread Updated':'Channel Updated',`${a.name} → ${b.name} (ID: ${b.id})`); if(a.permissionOverwrites?.cache && b.permissionOverwrites?.cache && a.permissionOverwrites.cache.map(x=>`${x.id}:${x.allow.bitfield}:${x.deny.bitfield}`).join('|')!==b.permissionOverwrites.cache.map(x=>`${x.id}:${x.allow.bitfield}:${x.deny.bitfield}`).join('|')) audit('Channel Permissions',`Permission overwrites changed in #${b.name} (ID: ${b.id}).`); });
client.on('channelDelete',c=>audit(c.isThread()?'Thread Deleted':'Channel Deleted',`${c.name} (ID: ${c.id})`));
client.on('roleCreate',r=>audit('Role Created',`${r.name} (ID: ${r.id})`));
client.on('roleUpdate',(a,b)=>audit('Role Updated',`${a.name} → ${b.name} (ID: ${b.id})`));
client.on('roleDelete',r=>audit('Role Deleted',`${r.name} (ID: ${r.id})`));
client.on('guildUpdate',(a,b)=>audit('Server Updated',`${a.name} → ${b.name} (ID: ${b.id})`));
client.on('emojiUpdate',(a,b)=>audit('Emojis Updated',`${a.name} → ${b.name}`));
client.on('emojiCreate',e=>audit('Emojis Updated',`Emoji added: ${e.name}`));
client.on('emojiDelete',e=>audit('Emojis Updated',`Emoji removed: ${e.name}`));
client.on('stickerCreate',s=>audit('Stickers Updated',`Sticker added: ${s.name}`));
client.on('stickerUpdate',(a,b)=>audit('Stickers Updated',`Sticker updated: ${a.name} → ${b.name}`));
client.on('stickerDelete',s=>audit('Stickers Updated',`Sticker removed: ${s.name}`));
client.on('inviteCreate',i=>audit('Server Invites',`Invite created by ${tag(i.inviter)}: ${i.code}`));
client.on('inviteDelete',i=>audit('Server Invites',`Invite deleted: ${i.code}`));
client.on('voiceStateUpdate',(oldS,newS)=>{
 const u=tag(newS.member?.user||oldS.member?.user); let title='Voice State',desc=`${u}: ${oldS.channelId||'none'} → ${newS.channelId||'none'}`;
 if(!oldS.channelId&&newS.channelId)title='Voice Joined'; else if(oldS.channelId&&!newS.channelId){title='Voice Left';} else if(oldS.channelId&&newS.channelId&&oldS.channelId!==newS.channelId){title='Voice Switched'; audit('Voice Move',`${u} moved from <#${oldS.channelId}> to <#${newS.channelId}>.`,0x5865F2);} else if(oldS.serverMute!==newS.serverMute||oldS.serverDeaf!==newS.serverDeaf)title='Voice State';
 audit(title,desc,0x5865F2); if(oldS.channelId&&!newS.channelId) audit('Voice Disconnect',`${u} disconnected from voice <#${oldS.channelId}>.`,0x5865F2);
});

client.once('ready',()=>console.log(`Legend RolePlay bot online as ${client.user.tag}`));

const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Legend RolePlay Bot is online!');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

if (!token) {
  console.error('[STARTUP] DISCORD_BOT_TOKEN is missing. Add it to the bot environment/.env file.');
} else {
  client.login(token).catch(error =>
    console.error('[STARTUP] Discord login failed:', error.message)
  );
}