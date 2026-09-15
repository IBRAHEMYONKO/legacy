'use strict';

const { classifyAuthResult } = require('./auth-diagnostics');

/**
 * Resolve the canonical LEGACY user id for a verified Discord-backed session.
 *
 * Discord is the canonical identity source. A JWT may contain an old local UUID after
 * the local database is recreated, so the Discord id is allowed to recover the
 * current LEGACY user row.
 */
async function resolveSessionUserId(pool, claims) {
  if (!claims?.userId && !claims?.discordId) {
    console.warn('[LEGACY:auth] session=missing-claims');
    return null;
  }

  if (claims.userId) {
    const direct = await pool.query(
      'SELECT d.user_id FROM discord_accounts d WHERE d.user_id=$1 AND ($2::text IS NULL OR d.discord_id=$2) LIMIT 1',
      [claims.userId, claims.discordId || null]
    );
    if (direct.rowCount) return direct.rows[0].user_id;
  }

  if (claims.discordId) {
    const byDiscord = await pool.query(
      'SELECT user_id FROM discord_accounts WHERE discord_id=$1 LIMIT 1',
      [claims.discordId]
    );
    if (byDiscord.rowCount) return byDiscord.rows[0].user_id;
  }

  console.warn(`[LEGACY:auth] session=${classifyAuthResult({ hasBearer: true, verified: true, linked: false })} discordLinked=false discordIdPresent=${claims.discordId ? 'yes' : 'no'}`);
  return null;
}

/**
 * Return claims with the canonical current LEGACY user id.
 * Returns null when the JWT is valid but no Discord-linked LEGACY account exists.
 */
async function resolveAuthClaims(pool, claims) {
  const userId = await resolveSessionUserId(pool, claims);
  if (!userId) return null;
  return { ...claims, userId };
}

module.exports = { resolveSessionUserId, resolveAuthClaims };
