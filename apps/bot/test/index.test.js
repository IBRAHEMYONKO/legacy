const test = require('node:test');
const assert = require('node:assert/strict');
const { isLegacyCommand, getBotStatus } = require('../src/index');

test('legacy command only matches the exact prefix command', () => {
  assert.equal(isLegacyCommand('legacy'), true);
  assert.equal(isLegacyCommand(' LEGACY '), true);
  assert.equal(isLegacyCommand('legacy now'), false);
  assert.equal(isLegacyCommand('!legacy'), false);
});

test('bot status exposes a useful local diagnostic', () => {
  const status = getBotStatus({ user: { tag: 'LEGACY#0001' }, ws: { ping: 42 }, readyAt: new Date('2026-01-01T00:00:00Z') });
  assert.equal(status.tag, 'LEGACY#0001');
  assert.equal(status.ping, 42);
  assert.equal(status.ready, true);
});
