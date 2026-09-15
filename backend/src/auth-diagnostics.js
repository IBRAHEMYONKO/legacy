'use strict';

function classifyAuthResult({ hasBearer, verified, linked } = {}) {
  if (!hasBearer) return 'missing-bearer';
  if (!verified) return 'jwt-invalid';
  if (!linked) return 'account-unlinked';
  return 'authenticated';
}

module.exports = { classifyAuthResult };
