const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRewards } = require('../src/rewards');

test('normalizeRewards accepts points, item and premium rewards', () => {
  assert.deepEqual(normalizeRewards([
    { type: 'points', amount: 1000 },
    { type: 'item', itemId: 'abc', quantity: 2 },
    { type: 'premium_days', days: 7 }
  ]), [
    { type: 'points', amount: 1000 },
    { type: 'item', itemId: 'abc', quantity: 2 },
    { type: 'premium_days', days: 7 }
  ]);
});

test('normalizeRewards rejects unknown or invalid rewards', () => {
  assert.throws(() => normalizeRewards([{ type: 'points', amount: -1 }]), /reward/i);
  assert.throws(() => normalizeRewards([{ type: 'unknown' }]), /reward/i);
});
