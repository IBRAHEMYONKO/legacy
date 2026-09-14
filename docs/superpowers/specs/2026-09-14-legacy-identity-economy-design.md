# LEGACY Identity, Economy & Discord Integration Design

## Goal
Turn LEGACY from a prototype UI into a real Discord-backed social platform foundation where Discord identity is canonical, profiles are live, points are authoritative, and titles/badges/store inventory are shared by the website, Activity, and Discord bot.

## Scope of this phase
This phase is the foundation for the larger LEGACY platform. It covers four tightly connected capabilities:

1. Discord identity synchronization.
2. Real profile presentation using Discord avatar/username/display name.
3. A real points ledger and balance calculation.
4. Titles, badges, inventory, and a working store model that can later be administered from Discord.

The full social feed, stories, DMs, groups, tasks, redeem-code management, and rich admin tooling remain later phases and must consume the same shared services instead of creating parallel data models.

## Canonical identity
`discord_accounts.discord_id` is the external identity key. The internal `users.id` remains the stable LEGACY primary key.

On successful Discord OAuth callback:
- create the LEGACY user if it does not exist;
- upsert the Discord account;
- synchronize `username`, `global_name`, and `avatar_url`;
- preserve LEGACY-owned profile fields such as bio, banner, level, and settings;
- issue the normal LEGACY JWT containing only the internal user identifier and required session claims.

Discord avatar URLs are derived from the Discord account data and are not uploaded into local storage in this phase. If Discord reports no custom avatar, the UI falls back to Discord's default avatar representation.

## Profile model
The profile API returns one normalized object containing:
- Discord identity: id, username, global name, avatar URL;
- LEGACY profile: display name, bio, banner, level, experience, premium expiry;
- economy: points balance;
- selected title;
- visible badges;
- selected cosmetic inventory references.

The website must render this normalized object instead of maintaining a second local identity representation.

## Points
Points are authoritative in the backend. `point_transactions` is the ledger.

Rules:
- positive amounts add points;
- negative amounts spend points;
- every mutation records a non-empty reason;
- purchases and admin grants happen inside a database transaction;
- a balance is derived from the ledger rather than trusted from the browser;
- the API rejects a spend that would make the balance negative;
- the client never sends a target balance.

The first phase seeds a small set of legitimate starter catalog items and a developer grant mechanism for the configured LEGACY admin IDs. No fake periodic points are generated.

## Titles
Titles are first-class catalog/inventory objects with a selectable active title.

A user may own multiple titles but only one is selected at a time. Titles can be acquired through the store or granted by an administrator. The selected title is stored as a profile reference and must reference an owned title.

Initial seed titles:
- مؤسس LEGACY
- المطور
- الأسطورة
- النخبة
- المخضرم
- صانع LEGACY

## Badges
Badges are separate from titles.

Initial badge set:
- Developer / المطور
- Founder / المؤسس
- Premium
- Early Member

Developer and Founder are privileged badges and are not purchasable. The Developer badge is automatically visible for configured LEGACY developer/admin IDs. The remaining badge inventory is extensible through catalog metadata and later admin tooling.

## Store and inventory
Catalog items use `catalog_items` and are typed through a constrained application-level type vocabulary:
- `title`
- `badge`
- `frame`
- `background`
- `effect`
- `premium`

Purchasing an item must atomically:
1. lock/check the active catalog item;
2. calculate the current authoritative balance;
3. reject insufficient funds;
4. insert the purchase record;
5. subtract points through `point_transactions`;
6. grant/increment inventory.

The API returns the updated balance and inventory state so the UI updates immediately.

## Discord bot integration
The existing prefix command `legacy` remains the only normal user command.

For normal users it will expose a user dashboard with:
- profile;
- points;
- store;
- inventory;
- titles;
- badges.

For configured administrators it exposes the admin dashboard. The first implementation focuses on real points/catalog/title/badge operations; task and redeem-code management follow after the foundation is stable.

The bot must call the same backend service/database logic rather than maintaining a second economy database.

## Website experience
The first UI pass replaces placeholder identity/economy content with:
- Discord avatar and display identity;
- live points balance;
- selected title;
- visible badge strip;
- level/progress;
- inventory/store cards;
- recent point activity;
- stronger visual hierarchy and motion without relying on fake data.

All sensitive mutations remain backend/API operations.

## Security
- Never expose Discord client secrets or bot tokens to the frontend.
- OAuth callback validates the returned Discord token response before synchronization.
- JWT payload remains minimal.
- Admin privileges are determined server-side from `LEGACY_ADMIN_IDS` and never from client-provided flags.
- Store purchase requests accept only an item identifier; price and reward are read server-side.
- Point transactions are immutable ledger records.

## Compatibility
Existing tables are retained where they already represent the correct concept. The implementation may add columns/tables/indexes, but it must not create a parallel user/economy store.

## Acceptance criteria
- Logging in with Discord creates or updates the same LEGACY account.
- The website shows the user's current Discord avatar and username/display name.
- Points can be granted and spent through real API calls and survive a restart.
- Store purchases persist and appear in inventory.
- Titles can be owned and selected.
- Developer badge/title can be shown for configured developers.
- The Discord `legacy` command reads the same profile, points, titles, badges, and inventory as the website.
- Existing OAuth flow continues to work with the root `.env` configuration.
- Existing backend tests continue to pass.
