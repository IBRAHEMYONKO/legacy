# LEGACY Platform Build Design

**Date:** 2026-09-14

## Goal

Complete LEGACY as a locally runnable social platform whose Discord bot, website, and Discord Activity share one backend, one account identity, and one database. Local development is the first-class environment; the same configuration model must remain portable to a future hosted deployment without rewriting the authentication architecture.

## Product shape

LEGACY is one product with three clients:

- **Discord Bot:** prefix-only `legacy` entry point, with a limited user dashboard and a full admin dashboard for authorized administrators.
- **Website:** the primary full social experience, including authentication, profiles, social features, economy, inventory, shop, Premium, leaderboards, notifications, groups, and administration where appropriate.
- **Discord Activity:** the same social experience embedded in Discord and authenticated against the same backend identity.

All persistent user state belongs to the backend/database rather than to an individual client.

## Local-first authentication and linking

Website authentication uses Discord OAuth2. The backend exchanges the authorization code, creates/updates the shared user and Discord-account records, and issues a signed session token. The website stores only the session token needed to call the API.

The Activity authenticates through Discord's Activity context and resolves the same Discord user to the same LEGACY account. The bot identifies users by Discord ID and uses the same account records.

The OAuth redirect is configuration-driven through environment variables, so local development can use localhost callback URLs and a future deployment can use hosted callback URLs without changing application logic.

The local setup must make the following flow work end-to-end:

```text
Website -> API -> Discord OAuth -> API callback -> LEGACY account -> Website session
Bot     -> API/internal auth -> same LEGACY account
Activity-> API/auth         -> same LEGACY account
```

## Runtime architecture

```text
LEGACY
├── backend/             Express API, OAuth, sessions, internal API
├── apps/bot/            Discord.js client and prefix dashboard
├── apps/web/            React/Vite website
├── apps/activity/       React/Vite Activity client
├── database/             PostgreSQL schema
├── shared/               shared contracts/helpers where useful
└── docs/                 architecture, specs and implementation plans
```

Local development uses separate processes/ports for API, website, Activity, and bot. The clients communicate through the API. PostgreSQL/Supabase is the persistent data layer.

The implementation must not depend on Vercel, Fly.io, a custom bot host, or any other deployment platform. Hosting-specific integration is deferred until the local build is complete.

## Website visual direction

Replace the current visual identity with a dark, modern palette centered on:

- deep green
- teal
- blue-green
- muted olive
- dark slate backgrounds
- restrained cyan/green glow

The visual language should feel like one polished social platform rather than a generic admin dashboard. Contrast and readability remain more important than decorative glow.

## Core data/features

The shared database and API will support:

- accounts and Discord identity linking
- customizable profiles
- avatars, banners and cosmetic profile presentation
- points/economy
- catalog/shop
- inventory and purchases
- Premium
- frames, backgrounds, badges, effects and name styles
- points, level and activity leaderboards
- friendships/following foundations
- private conversations/messages foundations
- blocks/mutes foundations
- groups and group membership/roles/permissions
- notifications
- audit logs
- dynamic redeem codes with configurable rewards, usage limits, expiry and per-user limits
- dynamic catalog/content management from the admin dashboard

Media upload architecture must be storage-provider friendly. The application should not hard-code a hosting vendor into business logic.

## Discord command model

The normal user-facing bot entry point remains exactly:

```text
legacy
```

No slash commands are introduced for the normal LEGACY dashboard. The command opens a button/select-menu based dashboard. Authorized administrators receive additional management controls from the same entry point.

## Security

Secrets are never committed to GitHub. Environment variables hold Discord tokens/client secrets, database credentials, JWT secret, internal API key, and other private values. The repository contains only `.env.example` placeholders.

Session/authentication code must validate tokens and identity server-side. Administrative actions require server-side authorization checks and create audit records where applicable.

## Error handling

The API must return consistent JSON error responses. OAuth failures must return a user-readable failure page/response rather than an unhandled exception. Client API calls must handle expired/invalid sessions and show a recoverable login state.

Startup must validate required configuration and fail clearly when a required environment variable or database connection is missing.

## Testing and local acceptance

The finished local build is accepted when:

1. PostgreSQL/Supabase schema can be initialized from the repository.
2. API starts locally with environment variables.
3. Website starts locally and uses the configured local API URL rather than `localhost` hard-coded into production client code.
4. Discord OAuth login completes locally using the configured callback URL.
5. A logged-in user resolves to the same LEGACY account in API, website, Activity and bot flows.
6. Bot `legacy` opens the user dashboard and authorized admin dashboard.
7. Activity can authenticate and read the same account data.
8. Core profile, points, inventory, shop and leaderboard reads work against the real database.
9. The updated green/blue/teal/olive visual system is applied consistently across the website.
10. No deployment provider is required to run the local system.

## Scope order

Build in independently testable passes:

1. local runtime/configuration and authentication/linking reliability
2. shared API/data foundations and profile/economy experience
3. website visual redesign and social shell
4. dynamic catalog, Premium and redeem-code system
5. social chat/friends/groups/notifications foundations
6. Activity parity and authentication
7. admin/content management completion
8. media uploads and final local integration pass

Deployment-specific work is explicitly outside this pass.
