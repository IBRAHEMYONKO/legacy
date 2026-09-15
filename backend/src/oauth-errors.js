'use strict';

const SECRET_PATTERNS = [
  /access_token[\s=:]+[^\s,&]+/gi,
  /client_secret[\s=:]+[^\s,&]+/gi,
  /authorization\s*:\s*(?:bearer|bot)\s+[^\s,&]+/gi,
  /(?:bot|bearer)\s+[A-Za-z0-9._-]{16,}/gi,
  /code[\s=:]+[A-Za-z0-9._-]{20,}/gi
];

function redactSecrets(value) {
  let text = String(value || '');
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, '[محجوب]');
  return text.slice(0, 700).trim();
}

function formatOAuthFailure(error) {
  const raw = redactSecrets(error?.message || error || '');
  if (!raw) return 'تعذر إكمال تسجيل Discord. حاول مرة أخرى.';
  return `تعذر إكمال تسجيل Discord: ${raw}`;
}

module.exports = { formatOAuthFailure, redactSecrets };
