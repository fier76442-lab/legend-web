export async function discordCreateMessage(channelId:string, payload:unknown){
 const token=process.env.DISCORD_BOT_TOKEN;
 if(!token) throw new Error('DISCORD_BOT_TOKEN is missing');
 const r=await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`,{
  method:'POST',headers:{'Authorization':`Bot ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)
 });
 if(!r.ok) throw new Error(`Discord API error ${r.status}: ${await r.text()}`);
 return r.json();
}