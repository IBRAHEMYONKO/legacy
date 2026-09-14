# LEGACY

LEGACY is one social platform with three clients sharing one backend, one database and one Discord identity:

- **Discord Bot** — the single `legacy` entry point for normal users and administrators.
- **Website** — the main social/profile/economy experience.
- **Discord Activity** — the same account and social experience embedded in Discord.

## Local-first development

Deployment providers are intentionally ignored while the product is being built. The repository is designed to run locally first and keep the same environment-variable based URLs when moved later.

### Local architecture

```text
Website :5173 ─┐
Activity :5174 ─┼─> LEGACY API :4000 ─> Embedded PostgreSQL (PGlite)
Discord Bot ────┘
```

Local development uses PGlite, an embedded PostgreSQL-compatible database. You do **not** need to install PostgreSQL separately. The database persists under `backend/data/legacy` and is ignored by Git.

### Start everything with one command

Requirements:

- Node.js 24+
- A Discord application with OAuth2 configured
- Message Content Intent enabled for the bot

Setup:

```bash
npm install
```

Copy `.env.example` to `.env` and fill the real Discord credentials. Never commit `.env`.

For local development keep:

```env
LEGACY_DB_MODE=local
LEGACY_DB_PATH=backend/data/legacy
```

The API automatically creates and initializes the local database from `database/schema.sql` on first start.

Then run:

```bash
npm run dev
```

The root runner starts the API, bot, website and Activity together.

For a production-style local preview after building the clients:

```bash
npm start
```

### PostgreSQL / Supabase later

When you want to use a normal PostgreSQL server or Supabase, change:

```env
LEGACY_DB_MODE=postgres
DATABASE_URL=postgresql://...
```

The application SQL remains PostgreSQL-compatible, so moving from local PGlite to PostgreSQL/Supabase does not require changing the frontend or API contracts.

### Discord OAuth2 local callback

Register this callback in the Discord Developer Portal:

```text
http://localhost:4000/auth/discord/callback
```

The Activity callback is kept separately in `DISCORD_ACTIVITY_REDIRECT_URI`.

The important part is that the application code does not hard-code a future hosted domain. Change `WEB_URL`, `ACTIVITY_URL`, `DISCORD_REDIRECT_URI`, and the API URL environment variables when moving environments.

## Discord philosophy

Normal users have exactly one command:

```text
legacy
```

The command opens the user's dashboard. Profile, Premium, points, inventory, shop, leaderboard, social and settings are dashboard actions rather than separate commands.

Administrators also type `legacy` and receive the administration dashboard, including user lookup, point management, inventory inspection, catalog management, Premium/code controls and audit logs.

## Shared account

Website login uses Discord OAuth2. The backend creates or updates one LEGACY user keyed to the Discord account. The bot and Activity resolve that same user record, so points, profile data, inventory, Premium, social state and notifications are not duplicated between clients.

## Website identity

The website uses a dark visual system built around:

- deep green
- teal
- blue-green
- muted olive
- dark slate
- restrained green/cyan glow

## Repository

```text
apps/
  bot/       Discord.js 14 bot
  web/       React/Vite website
  activity/  React/Vite Discord Activity
backend/     Express API + Discord OAuth + internal bot API
database/    PostgreSQL-compatible schema
shared/      shared contracts
index.js     one-command local process runner
docs/        architecture, specs and implementation plans
```

## Current foundation

Implemented across the current build:

- Monorepo/workspaces
- PostgreSQL-compatible schema for accounts, profiles, points, inventory, catalog, purchases, codes, friendships, groups, notifications, conversations, blocks and audit logs
- Persistent embedded local database for development
- Discord OAuth2 website login
- Shared JWT account session
- Activity authentication endpoint
- Discord bot `legacy` command
- Separate normal-user and admin dashboards
- Real profile/points/inventory/shop/leaderboard API reads
- Shop purchase transaction
- Redeem-code reward transaction system
- Friend request foundations
- Notifications
- Admin user lookup, point adjustment, catalog creation and audit logs
- One-command local runner
- Responsive green/teal/blue/olive website redesign
- Activity visual alignment with the website

The remaining build work expands realtime chat, groups/roles, richer customization/media storage, Activity parity, and final local integration verification.
