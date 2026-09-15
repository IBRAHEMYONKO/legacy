import test from 'node:test';
import assert from 'node:assert/strict';
import { readOAuthResult, resolveApiOrigin } from '../src/oauth-result.js';

test('reads a successful OAuth token from the callback URL', () => {
  assert.deepEqual(readOAuthResult({ search: '?token=abc123' }), {
    token: 'abc123',
    error: ''
  });
});

test('reads an OAuth failure without treating it as a token', () => {
  assert.deepEqual(readOAuthResult({ search: '?auth_error=Discord%20رفض%20إضافة%20العضو' }), {
    token: '',
    error: 'Discord رفض إضافة العضو'
  });
});

test('returns empty values for an ordinary URL', () => {
  assert.deepEqual(readOAuthResult({ search: '' }), { token: '', error: '' });
});

test('uses the browser origin for the API when the configured API is localhost', () => {
  assert.equal(
    resolveApiOrigin('http://localhost:4000', 'https://public.example.trycloudflare.com'),
    'https://public.example.trycloudflare.com'
  );
});
