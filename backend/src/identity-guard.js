'use strict';

/**
 * Discord is the canonical identity source for LEGACY.
 * This database trigger makes profile.display_name and profile.avatar_url
 * non-editable through normal profile updates. They are automatically kept
 * equal to the linked Discord account values.
 */
async function ensureIdentityGuard(pool) {
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
}

module.exports = { ensureIdentityGuard };
