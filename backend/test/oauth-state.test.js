'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createOAuthState,
  readOAuthState,
  resolveOAuthReturnUrl,
  resolveOAuthBrowserReturnUrl
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

test('prefers the public browser origin over a stale localhost return_to value', () => {
  const result = resolveOAuthBrowserReturnUrl({
    requested: 'http://localhost:5173',
    origin: 'https://sixth-locking-tonight-specification.trycloudflare.com',
    referer: 'https://sixth-locking-tonight-specification.trycloudflare.com/'
  }, 'http://localhost:5173');
  assert.equal(result, 'https://sixth-locking-tonight-specification.trycloudflare.com');
});

test('falls back safely when browser origin is not allowed', () => {
  const result = resolveOAuthBrowserReturnUrl({
    requested: 'http://localhost:5173',
    origin: 'https://evil.example.com',
    referer: 'https://evil.example.com/login'
  }, 'http://localhost:5173');
  assert.equal(result, 'http://localhost:5173');
});
