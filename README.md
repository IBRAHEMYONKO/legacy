# LEGACY

LEGACY is not a Discord bot only. It is one social platform with three clients sharing the same backend and database:

- Discord Bot — lightweight user entry point + full administration controls.
- Website — full social/profile/economy experience.
- Discord Activity — the same experience embedded inside Discord.

## Discord philosophy

Normal users have one command:

```text
legacy
```

That command opens their limited dashboard. Profile, Premium, points, inventory, shop, leaderboard, social and settings are navigated from buttons.

Administrators also type `legacy`, but receive the full administration dashboard. Administration can inspect users, adjust points, inspect inventories, manage catalog content and audit actions. More administration modules are built on the same dashboard pattern.

## Shared account

Website login uses Discord OAuth2. The Activity uses Discord authentication and sends the identity to the same API. The bot uses the same Discord ID as the account key. User state therefore lives in PostgreSQL rather than in the individual clients.

Discord's current developer documentation supports OAuth2 account authorization and embedded web experiences through its SDK/platform. LEGACY keeps the backend as the source of truth rather than storing independent data in the Activity or website.

## Repository

```text
apps/
  bot/       Discord.js 14 bot
  web/       React/Vite website
  activity/  React/Vite Discord Activity
backend/     Express API + Discord OAuth + internal bot API
database/    PostgreSQL schema
shared/      shared contracts (reserved for next stage)
docs/        architecture and implementation plans
```

## Local setup

1. Create a PostgreSQL/Supabase database.
2. Run `database/schema.sql` against it.
3. Copy `.env.example` to `.env` and fill the Discord application credentials, database URL and `LEGACY_ADMIN_IDS`.
4. Set a long random `JWT_SECRET` and `LEGACY_INTERNAL_KEY`.
5. Install workspaces with `npm install`.
6. Start API, bot, website and Activity using the workspace scripts.

The Discord application must have the Message Content Intent enabled because the normal entry point is the prefix message `legacy` rather than slash commands.

## Current foundation

Implemented in the first build pass:

- Monorepo/workspaces
- PostgreSQL schema for accounts, profiles, points, inventory, catalog, purchases, codes, friendships, groups, notifications and audit logs
- Discord OAuth2 website login
- Shared JWT account session
- Activity authentication endpoint
- Discord bot `legacy` command
- Separate normal-user and admin dashboards
- Real profile/points/inventory/shop/leaderboard reads from the shared API
- Admin user lookup
- Admin point adjustment from Discord with audit logging
- Admin inventory inspection from Discord
- Admin catalog creation entry point
- Admin audit log view
- Responsive website dashboard
- Activity shell connected to the same backend
- Internal bot-to-API authentication

The next implementation passes expand the dynamic catalog, Premium, codes/rewards, social/chat/groups, media uploads, real-time events, and production deployment/security.
