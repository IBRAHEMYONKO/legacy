'use strict';

/**
 * Resolve the canonical LEGACY user id for a verified Discord-backed session.
 *
 * A JWT may contain a userId created before the local database was recreated or
 * migrated. Discord remains the canonical identity, so the discordId can
 * recover the current user row without forcing a new login.
 */
async function resolveSessionUserId(pool, claims) {
  if (!claims?.userId && !claims?.discordId) return null;

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

  return null;
}

module.exports = { resolveSessionUserId };
