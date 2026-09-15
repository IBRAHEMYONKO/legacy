'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyAuthResult } = require('../src/auth-diagnostics');

test('classifies a missing bearer token separately', () => {
  assert.equal(classifyAuthResult({ hasBearer: false, verified: false, linked: false }), 'missing-bearer');
});

test('classifies a JWT verification failure separately', () => {
  assert.equal(classifyAuthResult({ hasBearer: true, verified: false, linked: false }), 'jwt-invalid');
});

test('classifies a verified token with no linked LEGACY account separately', () => {
  assert.equal(classifyAuthResult({ hasBearer: true, verified: true, linked: false }), 'account-unlinked');
});

test('classifies a fully authenticated request as authenticated', () => {
  assert.equal(classifyAuthResult({ hasBearer: true, verified: true, linked: true }), 'authenticated');
});
