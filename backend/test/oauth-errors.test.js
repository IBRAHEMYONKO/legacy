'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatOAuthFailure } = require('../src/oauth-errors');

test('formats a guild-join failure with the real Discord reason', () => {
  assert.equal(
    formatOAuthFailure(new Error('Discord رفض إضافة العضو (403) — Missing Permissions [Discord 50013]')),
    'تعذر إكمال تسجيل Discord: Discord رفض إضافة العضو (403) — Missing Permissions [Discord 50013]'
  );
});

test('uses a safe fallback for unknown OAuth failures', () => {
  assert.equal(formatOAuthFailure(null), 'تعذر إكمال تسجيل Discord. حاول مرة أخرى.');
});
