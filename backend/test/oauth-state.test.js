'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createOAuthState,
  readOAuthState,
  resolveOAuthReturnUrl
} = require('../src/oauth-state');

test('preserves the browser origin through the Discord OAuth callback', () => {
  const secret = 'test-secret';
  const state = createOAuthState('https://public.example.com', secret);
  const result = readOAuthState(state, secret);
  assert.equal(result.returnTo, 'https://public.example.com');
});

test('rejects a forged OAuth state', () => {
  const state = createOAuthState('https://public.example.com', 'test-secret');
  assert.throws(() => readOAuthState(state, 'wrong-secret'));
});

test('allows configured website and TryCloudflare origins only', () => {
  assert.equal(
    resolveOAuthReturnUrl('https://public.example.com', 'http://localhost:5173'),
    'http://localhost:5173'
  );
  assert.equal(
    resolveOAuthReturnUrl('https://column-came-rent-maple.trycloudflare.com', 'http://localhost:5173'),
    'https://column-came-rent-maple.trycloudflare.com'
  );
  assert.equal(
    resolveOAuthReturnUrl('https://evil.example.com', 'http://localhost:5173'),
    'http://localhost:5173'
  );
});
