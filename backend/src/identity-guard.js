'use strict';

/**
 * Discord is the canonical identity source for LEGACY.
 *
 * The trigger is a database-level safety net. Local PGlite installations can
 * occasionally fail to create procedural triggers while the database is
 * being initialized, so trigger setup must never prevent the API from booting.
 * The API also enforces the same rule when profile data is updated.
 */
async function ensureIdentityGuard(pool) {
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION legacy_sync_discord_identity()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        discord_name TEXT;
        discord_avatar TEXT;
      BEGIN
        SELECT COALESCE(global_name, username), avatar_url
          INTO discord_name, discord_avatar
        FROM discord_accounts
        WHERE user_id = NEW.user_id
        LIMIT 1;

        IF discord_name IS NOT NULL OR discord_avatar IS NOT NULL THEN
          NEW.display_name := discord_name;
          NEW.avatar_url := discord_avatar;
        END IF;

        RETURN NEW;
      END;
      $$;
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS legacy_profile_discord_identity ON profiles;
      CREATE TRIGGER legacy_profile_discord_identity
      BEFORE UPDATE OF display_name, avatar_url ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION legacy_sync_discord_identity();
    `);
  } catch (error) {
    console.warn('[LEGACY:db] Discord identity trigger setup skipped:', error?.message || error);
  }
}

module.exports = { ensureIdentityGuard };
