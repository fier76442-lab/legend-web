# Legend RolePlay

Next.js website starter for Legend RolePlay.

## Run
1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Fill Discord credentials.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open http://localhost:3000.

## Important
The website UI, pages, rules, role IDs, application forms and Discord submission endpoints are included.

The Accept/Denied interaction bot and Discord OAuth2 session layer are intentionally separated in `discord-bot/` so secrets are not hard-coded. Add your Discord bot token and configure the review/result channels in `.env` before using the application workflow in production.

Gallery channel:
1552414400894210149

Whitelist review/result:
1552413863880818779 / 1552413852313067602

Staff review/result:
1553161152337551450 / 1552414631585255444

## Discord Staff + Connect to Discord
Set these variables in the root `.env`:
- `DISCORD_BOT_TOKEN` = your Discord bot token (keep secret)
- `DISCORD_GUILD_ID` = your Legend RolePlay server ID
- `DISCORD_CLIENT_ID` = Discord application client ID
- `DISCORD_CLIENT_SECRET` = Discord OAuth2 client secret (keep secret)
- `DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback`
- `SESSION_SECRET` = long random secret

The Staff page reads current Discord guild members using the bot token and displays members who have one of the configured staff role IDs. The Staff page also includes a Connect to Discord OAuth2 button.
In the Discord Developer Portal, add the exact redirect URL above under OAuth2 Redirects and make sure the bot is in the guild. For member listing, enable the Server Members Intent for the bot if Discord requires it for your guild/member access.


## Recent website customization
- Full-screen YouTube background video (muted autoplay) and animated first-entry gate.
- Added Streamers, Gangs and Staff Panel navigation.
- Role Manager API validates the Discord OAuth session and checks the actor's live Discord roles before assigning only the configured allowed roles.
- Whitelist applications require Discord login and include the applicant Discord ID so the review bot can send the decision to the result channel.
- Shop and gang catalog forms support local image upload previews.

## Configuration and deployment
1. Copy `.env.example` to `.env.local` and fill in the Discord OAuth and bot settings. Never publish `.env` files or bot tokens.
2. In the Discord Developer Portal, set `DISCORD_REDIRECT_URI` to `https://YOUR-DOMAIN/api/auth/discord/callback`.
3. Invite the bot to your server with **Manage Roles**, **View Channels**, and **Send Messages**. Place its highest role above the roles it manages.
4. Run `npm install`, then `npm run dev` for local development or `npm run build && npm start` for production.
5. Run the Discord review bot from `discord-bot` separately and configure its `.env`.

**Important:** Store and Gang Manager forms currently save catalog entries in the current browser (`localStorage`), so they are a UI prototype and are not yet shared between staff/devices or automatically synced to Discord/FiveM. Live shared publishing needs a database and bot/server integration. Discord/FiveM log cards are placeholders until log sources are configured. The review bot needs to be running and the review/result channel IDs must be accessible to it.


## Staff panel, tickets and requested channels
- Staff panel, Gang Manager, Gallery Manager and Store Manager check the signed-in Discord account's live server roles. Configure `DISCORD_WHITELISTER_ROLE_ID` if you want the Whitelister role to be detected.
- Staff role IDs configured from the supplied list: Owner, Co Owner, Devlopper, Supervisor, Community Manager, Head Admin, Head Whitelister, Head Checker, Admin, Moderator, PC Checker and Support Team.
- Staff/ticket logs channel: `1559255898411638904`.
- Whitelist review/log channel: `1559255919282622616`.
- Tickets are available at `/tickets`: General Support, Donation, Ban Appeal, Refund, Partnership, Contact Developer, High Rank and Other. Users must sign in with Discord; the bot must have View Channel and Send Messages permissions in the log channel.
- The current browser-only Store, Gang and Gallery editors use localStorage, so they are not yet shared across staff devices. For production use, connect a database/object storage and move uploaded image data out of localStorage.
- Discord OAuth `identify` is used for sign-in; live staff authorization is re-checked against the configured Discord guild before panel/API access.

## Recent website updates

- Staff page is grouped into Owners, Management, High Staff and Staffs and syncs role membership from Discord.
- The Streamers page automatically lists members with Discord role `1559254039797964871`. Enable the **Server Members Intent** for the bot in Discord Developer Portal and make sure the bot can access the configured guild.
- A Gang & Family application is available at `/application/gang`. Set `DISCORD_GANG_REVIEW_CHANNEL_ID` to the staff review channel. If you want the backend to enforce whitelist membership, set `DISCORD_WHITELISTED_ROLE_ID` to the actual whitelist member role ID (not the staff whitelister role).
- The background uses the supplied Discord MP4 URL. Discord attachment links with signed query parameters can expire; for permanent hosting, put the video in `public/hero-background.mp4` and change the source in `app/layout.tsx` to `/hero-background.mp4`.
- Navbar has a centered layout and a persistent light/night theme toggle.


## Local development (website + Discord application buttons)

Run the website from the project root with `npm run dev`. The Discord button/modal handler is a separate process: open a second terminal, run `cd discord-bot`, `npm install`, then `npm start`. Ensure the bot folder has a `.env` containing `DISCORD_BOT_TOKEN` and the review/result channel IDs. The website `.env` and the bot `.env` are separate unless you deliberately configure them otherwise.
