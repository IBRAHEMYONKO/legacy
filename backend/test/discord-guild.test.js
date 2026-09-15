'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getBotGuildMember, joinLegacyGuild } = require('../src/discord-guild');

test('returns true when the user is already a member', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/members/')) return new Response('', { status: 200 });
    throw new Error('unexpected URL');
  };
  assert.equal(await getBotGuildMember('guild-1', 'user-1', fetchImpl), true);
  assert.equal(calls.length, 1);
});

test('adds an absent user and verifies membership again', async () => {
  let memberChecks = 0;
  const fetchImpl = async (url, options = {}) => {
    if (url.includes('/invites/')) return new Response(JSON.stringify({ guild: { id: 'guild-1', name: 'LEGACY' } }), { status: 200 });
    if (url.includes('/members/')) {
      memberChecks += 1;
      if (memberChecks === 1) return new Response('', { status: 404 });
      assert.equal(options.method, 'PUT');
      assert.deepEqual(JSON.parse(options.body), { access_token: 'oauth-token' });
      return new Response('', { status: 204 });
    }
    throw new Error('unexpected URL');
  };
  const result = await joinLegacyGuild('user-1', 'oauth-token', fetchImpl);
  assert.deepEqual(result, { id: 'guild-1', name: 'LEGACY', invite: 'https://discord.gg/ufEneEgpSA' });
  assert.equal(memberChecks, 2);
});

test('maps failed guild-add responses to actionable errors without exposing tokens', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/invites/')) return new Response(JSON.stringify({ guild: { id: 'guild-1', name: 'LEGACY' } }), { status: 200 });
    if (url.includes('/members/')) {
      return new Response(JSON.stringify({ message: 'Missing Permissions', code: 50013 }), { status: 403 });
    }
    throw new Error('unexpected URL');
  };
  await assert.rejects(
    () => joinLegacyGuild('user-1', 'super-secret-oauth-token', fetchImpl),
    /Missing Permissions.*50013/
  );
});
