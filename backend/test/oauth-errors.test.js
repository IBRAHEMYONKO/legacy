'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatOAuthFailure } = require('../src/oauth-errors');

test('formats guild-join failures without hiding the real Discord reason', () => {
  const message = formatOAuthFailure(new Error('Discord رفض إضافة العضو (403). السبب: Missing Permissions'));
  assert.match(message, /فشل تسجيل الدخول إلى LEGACY/);
  assert.match(message, /Missing Permissions/);
});

test('uses a safe fallback when OAuth throws an unknown value', () => {
  assert.equal(
    formatOAuthFailure(null),
    'فشل تسجيل الدخول إلى LEGACY. حاول مرة أخرى.'
  );
});
