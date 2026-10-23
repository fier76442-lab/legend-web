
export async function discordCreateMessage(
  channelId: string,
  payload: unknown
) {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error(
      'DISCORD_BOT_TOKEN is missing from the server environment.'
    );
  }

  const id = String(channelId || '').trim();

  if (!/^\d{17,20}$/.test(id)) {
    throw new Error(
      'Discord review channel ID is missing or invalid. Check DISCORD_WHITELIST_REVIEW_CHANNEL_ID in .env.'
    );
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${id}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  );

  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404 && data?.code === 10003) {
      throw new Error(
        'Discord channel not found. Check the channel ID and bot server access.'
      );
    }

    if (response.status === 403) {
      throw new Error(
        'Discord denied access. Give the bot View Channel, Send Messages, and Embed Links permissions.'
      );
    }

    throw new Error(
      `Discord API ${response.status}: ${
        data?.message || 'Could not send application.'
      }`
    );
  }

  return data;
}