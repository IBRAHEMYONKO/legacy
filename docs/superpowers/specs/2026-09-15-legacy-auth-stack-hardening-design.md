# LEGACY Auth & Stack Hardening Design

## Goal
Make the current LEGACY local stack reliable for Discord-backed authentication, mandatory server membership, web/Activity startup, and the Discord bot without silently returning users to the login screen.

## Scope
This hardening pass covers the existing authentication and integration paths only. It does not implement the full future social-feed feature set.

## Architecture
Discord remains the canonical identity source. The website and Activity receive a LEGACY JWT only after Discord OAuth succeeds and the user is verified/added to the required LEGACY guild. The backend owns OAuth validation, Discord identity persistence, guild membership handling, and session issuance; the frontend only consumes the resulting session or displays a structured authentication failure.

The local launcher starts the API first, waits for `/health`, then starts Web and Activity. Cloudflare Quick Tunnel remains an optional development convenience and is not treated as a permanent OAuth redirect origin.

## Required Behaviors

### 1. Discord OAuth
- Validate all required OAuth environment variables before redirecting.
- Use `identify guilds.join` for website/Activity authentication.
- Exchange the OAuth code against the exact configured redirect URI.
- Fetch `/users/@me` using the OAuth access token.
- Upsert the Discord account and profile using Discord username/global name/avatar as canonical identity data.
- Do not mint a LEGACY session until guild membership handling succeeds.

### 2. Required LEGACY Guild
- Resolve the required guild from `LEGACY_GUILD_INVITE`.
- Verify whether the Discord user is already a guild member.
- When absent, attempt Add Guild Member using the OAuth access token and the LEGACY bot token.
- Produce actionable error categories for missing bot token, invalid invite, missing guild membership access, invalid OAuth token/scope, application/bot mismatch, and Discord API failures.
- Re-check membership after an add operation before issuing the session.

### 3. Session and Identity
- Discord ID is canonical.
- JWTs include both the current LEGACY user ID and Discord ID.
- Valid stale JWTs may resolve through Discord ID after a local database reset.
- Profile display name/avatar cannot diverge from the linked Discord account.
- Authentication failures return a structured error rather than an opaque redirect loop.

### 4. Web Authentication UX
- Consume `token` from the callback URL and persist it.
- Consume `auth_error` from the callback URL and show a clear error screen/message.
- Remove OAuth query parameters from browser history after processing them.
- A failed authentication attempt must not leave a stale invalid token in localStorage.

### 5. Activity
- Keep Activity OAuth callback paths consistent with the backend route.
- Reuse the same canonical Discord identity and guild membership flow.
- Return useful JSON errors for Activity authentication failures.

### 6. Local Launcher
- Start API and bot first.
- Wait for API health before starting Web and Activity.
- Avoid duplicate Vite CLI flags.
- Keep optional Cloudflare startup independent from local service readiness.
- A Cloudflare Quick Tunnel URL must be treated as ephemeral development output; stable OAuth requires a registered redirect origin.

### 7. Bot
- Keep exactly the `legacy` prefix command for normal users and admins.
- Admin controls remain restricted by `LEGACY_ADMIN_IDS`.
- Internal API requests use `LEGACY_INTERNAL_KEY`.
- Remove or isolate duplicate/dead admin UI code paths so only one implementation owns each interaction ID.
- Bot startup and interaction failures must be logged with useful context.

### 8. Tests
Cover:
- canonical session resolution;
- stale JWT recovery by Discord ID;
- OAuth error formatting;
- guild membership success when already present;
- guild add success and post-add verification;
- representative Discord API failure mapping;
- website callback token and `auth_error` handling;
- Activity callback path consistency;
- API readiness before frontend startup;
- exact `legacy` command matching.

## Error Handling
Every boundary must preserve the real failure reason for logs and expose a safe actionable message to the user. OAuth secrets and access tokens must never be returned in responses or logs.

## Configuration Rules
- Local default website: `http://localhost:5173`.
- Local API: `http://localhost:4000`.
- Required guild invite code defaults to `ufEneEgpSA` only as a development convenience; production must set it explicitly.
- `DISCORD_REDIRECT_URI` must match a Discord Developer Portal redirect exactly.
- `DISCORD_BOT_TOKEN` must belong to the bot user associated with the same Discord application/client used for OAuth.

## Non-Goals
- No database migration from PGlite to hosted PostgreSQL in this pass.
- No redesign of the social feed or economy models.
- No permanent-domain deployment design.
