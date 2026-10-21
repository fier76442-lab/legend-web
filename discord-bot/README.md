## Legend RolePlay Discord Bot

Run:
npm install
set DISCORD_BOT_TOKEN in environment
set DISCORD_WHITELIST_RESULT_CHANNEL_ID=1552413852313067602
set DISCORD_STAFF_RESULT_CHANNEL_ID=1552414631585255444
node index.js

The production version should use the Discord OAuth user ID in the application payload/footer so the result message can mention the exact applicant. Do not hard-code bot tokens in source code.
