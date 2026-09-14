# LEGACY Social Core Design

## Goal
Transform LEGACY from a mostly presentational prototype into a shared, real social platform whose Discord identity, profile, points, inventory, titles, badges, store, and Discord bot all use the same backend data.

## Identity
- Discord ID is the canonical external identity.
- Discord username, global/display name, and avatar are synchronized on OAuth login.
- LEGACY profile avatar defaults to the current Discord avatar.
- The backend remains the source of truth; the browser cannot directly award points or grant inventory.

## Roles and badges
- LEGACY roles are represented as profile/system metadata.
- Initial developer role/badge is granted from `LEGACY_ADMIN_IDS`.
- Developer badge is distinct from achievement, event, premium, and shop badges.

## Economy
- Points are an append-only transaction ledger.
- Balance is derived from the ledger.
- Purchases execute atomically: verify balance, record negative transaction, record purchase, grant inventory.
- Inventory ownership is persisted and shared by website and bot.

## Catalog
Catalog item types include titles, badges, frames, backgrounds, effects, and premium-related items. Items are data-driven so administrators can create or deactivate them without changing application code.

## Discord bot integration
The bot uses the internal backend API authenticated by `LEGACY_INTERNAL_KEY`. The `legacy` prefix command remains the main user/admin entry point. User actions that change points or inventory go through the backend so website and bot cannot diverge.

## UI direction
The website becomes a lively social dashboard: Discord identity card, points balance, level/progress, equipped title, visible badges, inventory/store previews, leaderboard highlights, activity/notifications, and stronger navigation.

## First implementation scope
1. Harden Discord profile synchronization and developer identity.
2. Add persistent roles/badges/titles/catalog seed data and real purchase/equip APIs.
3. Upgrade website profile/dashboard/store UI to consume those APIs.
4. Connect the Discord `legacy` command to the same profile/economy APIs.
5. Add tests for identity synchronization, points ledger, purchases, inventory, and bot/backend authorization.

## Constraints
- Local-first; PGlite remains the local database and no separate PostgreSQL installation is required.
- Never expose Discord bot token, client secret, JWT secret, or internal key to the frontend.
- Existing OAuth redirect configuration remains unchanged.
- Existing API compatibility should be preserved where practical.
