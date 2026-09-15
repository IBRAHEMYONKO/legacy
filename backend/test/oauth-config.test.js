'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDiscordOAuthConfig } = require('../src/oauth-config');

test('uses explicit activity redirect URI when configured', () => {
  const config = getDiscordOAuthConfig({
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DISCORD_REDIRECT_URI: 'http://localhost:4000/auth/discord/callback',
    DISCORD_ACTIVITY_REDIRECT_URI: 'http://localhost:4000/activity/auth'
  });
  assert.equal(config.activityRedirectUri, 'http://localhost:4000/activity/auth');
  assert.equal(config.redirectUri, 'http://localhost:4000/auth/discord/callback');
  assert.equal(config.clientId, 'client');
  assert.equal(config.clientSecret, 'secret');
});

test('falls back from activity redirect URI to the website callback', () => {
  const config = getDiscordOAuthConfig({
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DISCORD_REDIRECT_URI: 'http://localhost:4000/auth/discord/callback'
  });
  assert.equal(config.activityRedirectUri, 'http://localhost:4000/auth/discord/callback');
});
