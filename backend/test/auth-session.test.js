'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSessionUserId, resolveAuthClaims } = require('../src/auth-session');

function poolFor(rowsByQuery) {
  return {
    async query(sql, params) {
      if (sql.includes('WHERE d.user_id=$1')) {
        const exact = rowsByQuery.direct && params[0] === rowsByQuery.direct && params[1] === rowsByQuery.discord;
        return { rowCount: exact ? 1 : 0, rows: exact ? [{ user_id: rowsByQuery.direct }] : [] };
      }
      if (sql.includes('WHERE discord_id=$1')) {
        return { rowCount: rowsByQuery.discord ? 1 : 0, rows: rowsByQuery.discord ? [{ user_id: rowsByQuery.discord }] : [] };
      }
      throw new Error(`unexpected query: ${sql}`);
    }
  };
}

test('keeps the current user id when the verified Discord-linked row matches', async () => {
  const result = await resolveSessionUserId(
    poolFor({ direct: 'current-user', discord: 'discord-user' }),
    { userId: 'current-user', discordId: 'discord-user' }
  );
  assert.equal(result, 'current-user');
});

test('recovers a stale JWT user id through the canonical Discord id', async () => {
  const result = await resolveSessionUserId(
    poolFor({ direct: null, discord: 'recreated-user' }),
    { userId: 'old-user', discordId: 'discord-user' }
  );
  assert.equal(result, 'recreated-user');
});

test('rejects a session when neither user id nor Discord id resolves', async () => {
  const result = await resolveSessionUserId(
    poolFor({ direct: null, discord: null }),
    { userId: 'missing-user', discordId: 'missing-discord' }
  );
  assert.equal(result, null);
});

test('falls back to Discord id when the JWT user id is paired with a different Discord account', async () => {
  const result = await resolveSessionUserId(
    poolFor({ direct: null, discord: 'discord-user-current' }),
    { userId: 'current-user', discordId: 'different-discord' }
  );
  assert.equal(result, 'discord-user-current');
});

test('rewrites authenticated claims to the canonical current user id', async () => {
  const result = await resolveAuthClaims(
    poolFor({ direct: null, discord: 'current-user' }),
    { userId: 'stale-user', discordId: 'discord-user' }
  );
  assert.deepEqual(result, { userId: 'current-user', discordId: 'discord-user' });
});
