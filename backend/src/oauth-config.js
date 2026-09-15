'use strict';

function clean(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function getDiscordOAuthConfig(env = process.env) {
  const clientId = clean(env.DISCORD_CLIENT_ID);
  const clientSecret = clean(env.DISCORD_CLIENT_SECRET);
  const redirectUri = clean(env.DISCORD_REDIRECT_URI);
  const activityRedirectUri = clean(env.DISCORD_ACTIVITY_REDIRECT_URI) || redirectUri;

  return {
    clientId,
    clientSecret,
    redirectUri,
    activityRedirectUri,
    scopes: ['identify', 'guilds.join']
  };
}

module.exports = { getDiscordOAuthConfig };
