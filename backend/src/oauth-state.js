'use strict';

const jwt = require('jsonwebtoken');

const STATE_TTL = '10m';

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) return '';
    return url.origin;
  } catch {
    return '';
  }
}

function resolveOAuthReturnUrl(requested, fallback) {
  const safeFallback = normalizeOrigin(fallback) || 'http://localhost:5173';
  const candidate = normalizeOrigin(requested);
  if (!candidate) return safeFallback;
  if (candidate === safeFallback) return candidate;

  const url = new URL(candidate);
  if (url.protocol === 'https:' && url.hostname.endsWith('.trycloudflare.com')) {
    return candidate;
  }

  const fallbackUrl = new URL(safeFallback);
  if (
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    url.port === (fallbackUrl.port || '80')
  ) {
    return candidate;
  }

  return safeFallback;
}

function resolveOAuthBrowserReturnUrl({ requested, origin, referer } = {}, fallback) {
  const safeFallback = normalizeOrigin(fallback) || 'http://localhost:5173';
  const browserCandidates = [origin, referer];

  for (const value of browserCandidates) {
    const candidate = normalizeOrigin(value);
    if (!candidate) continue;
    const safeCandidate = resolveOAuthReturnUrl(candidate, safeFallback);
    if (safeCandidate === candidate && safeCandidate !== safeFallback) return safeCandidate;
  }

  return resolveOAuthReturnUrl(requested, safeFallback);
}

function createOAuthState(returnTo, secret) {
  if (!secret) throw new Error('JWT_SECRET غير مضبوط في .env');
  const safeReturn = normalizeOrigin(returnTo);
  if (!safeReturn) throw new Error('Invalid OAuth return origin');

  return jwt.sign(
    { returnTo: safeReturn, purpose: 'discord-oauth' },
    secret,
    { expiresIn: STATE_TTL }
  );
}

function readOAuthState(state, secret) {
  if (!state) throw new Error('Missing Discord OAuth state');
  if (!secret) throw new Error('JWT_SECRET غير مضبوط في .env');

  const claims = jwt.verify(String(state), secret);
  const returnTo = normalizeOrigin(claims?.returnTo);
  if (claims?.purpose !== 'discord-oauth' || !returnTo) {
    throw new Error('Invalid Discord OAuth state');
  }

  return { ...claims, returnTo };
}

module.exports = {
  createOAuthState,
  readOAuthState,
  resolveOAuthReturnUrl,
  resolveOAuthBrowserReturnUrl
};
