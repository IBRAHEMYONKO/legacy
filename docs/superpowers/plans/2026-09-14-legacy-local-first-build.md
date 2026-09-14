# LEGACY Local-First Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue the existing LEGACY repository into a locally runnable social platform where Discord OAuth, the shared API, Discord bot, website, and Activity use one account/database, while the website adopts the requested green/blue/teal/olive identity.

**Architecture:** Keep the current Express + PostgreSQL + React/Vite + discord.js architecture instead of replacing the working foundation. Add a root local runner that starts the existing four processes, keep all URLs configurable through environment variables, and expand the already-present API routes before building richer client screens.

**Tech Stack:** Node.js 24+, Express 5, PostgreSQL/Supabase, JWT, React/Vite, discord.js 14.

**Spec:** `docs/superpowers/specs/2026-09-14-legacy-platform-build-design.md`

## Global Constraints

- Normal Discord users have exactly one command: `legacy`.
- Website, Activity and bot resolve the same PostgreSQL user through Discord ID.
- Localhost URLs are defaults only; deployment URLs come from environment variables.
- Secrets remain in `.env`, never in GitHub.
- Website palette is dark green/teal/blue-green/olive/slate.
- Existing working API/database routes are extended rather than discarded.

---

### Task 1: One-command local runtime

**Files:**
- Create: `index.js`
- Modify: `package.json`
- Create: `.gitignore`

**Interfaces:**
- `start()` starts API, bot, web and Activity child processes.
- `stop()` terminates every child process.
- Direct execution selects development mode by default and production-preview mode when `LEGACY_MODE=production`.

- [ ] Add a root runner using `child_process.spawn` and npm workspace scripts.
- [ ] Keep process environment inherited so `.env` remains the source of secrets.
- [ ] Add `dev` and `start` root scripts.
- [ ] Ignore `.env`, Vite output and local logs.
- [ ] Keep the runner platform-aware for Windows and Unix process termination.

### Task 2: Local authentication and API portability

**Files:**
- Modify: `backend/src/server.js`
- Modify: `.env.example`
- Create: `backend/test/auth-config.test.js`

**Interfaces:**
- `GET /auth/discord` uses `DISCORD_CLIENT_ID` and `DISCORD_REDIRECT_URI`.
- `GET /auth/discord/callback` resolves the same database user for every environment.
- `GET /api/me` remains the canonical authenticated account endpoint.

- [ ] Add configuration validation for JWT and Discord OAuth values without exposing secrets.
- [ ] Keep callback URL fully environment-driven.
- [ ] Ensure the website never depends on a production URL being compiled into source.
- [ ] Preserve Activity OAuth configuration separately from website OAuth.
- [ ] Add tests for missing/valid environment configuration.

### Task 3: Website visual and application shell

**Files:**
- Modify: `apps/web/src/main.jsx`
- Modify: `apps/web/src/style.css`
- Modify: `apps/web/index.html`

**Interfaces:**
- Landing page calls `/auth/discord` on the configured API.
- Authenticated shell reads `/api/me` and uses the same token for protected routes.
- Navigation exposes profile, points, inventory, shop, leaderboard, social, Premium, settings and admin.

- [ ] Replace purple identity with green/teal/blue/olive styling.
- [ ] Build responsive navigation and account header.
- [ ] Connect inventory and shop purchase actions to existing API endpoints.
- [ ] Add profile editing UI using `/api/profile`.
- [ ] Add friend request/respond UI using existing social endpoints.
- [ ] Add notifications and redeem-code UI.
- [ ] Add admin code/audit/user panels without exposing them to normal users.

### Task 4: Economy and rewards client completion

**Files:**
- Modify: `apps/web/src/main.jsx`
- Modify: `apps/web/src/style.css`
- Modify: `apps/bot/src/index.js`
- Modify: `apps/bot/src/admin-ui.js` as needed

**Interfaces:**
- Shop purchase uses `POST /api/shop/:itemId/buy`.
- Redeem uses `POST /api/codes/redeem`.
- Admin code creation uses `POST /api/admin/codes` or the existing internal bot route.

- [ ] Surface real inventory quantities and purchase state.
- [ ] Surface Premium status and point balance.
- [ ] Add dynamic redeem-code form.
- [ ] Add dynamic admin code creation with points/items/Premium reward arrays.
- [ ] Keep all mutations auditable through existing API behavior.

### Task 5: Social, chat and groups foundation

**Files:**
- Modify: `backend/src/extended-routes.js`
- Modify: `database/schema.sql` only where a missing constraint/index is proven necessary.
- Modify: `apps/web/src/main.jsx`
- Modify: `apps/web/src/style.css`

**Interfaces:**
- Friend request/list/respond routes remain authenticated.
- Conversations and messages are owned by authenticated users.
- Blocks prevent private interactions where applicable.
- Group membership and roles remain database-backed.

- [ ] Add missing conversation/message routes around the existing schema.
- [ ] Add group creation/list/member management routes.
- [ ] Add block/unblock/read-state flows.
- [ ] Connect the first social UI to real database data.
- [ ] Add notification refresh after social mutations.

### Task 6: Activity parity

**Files:**
- Modify: `apps/activity/src/main.jsx`
- Modify: `apps/activity/src/style.css`
- Modify: `apps/activity/index.html`

**Interfaces:**
- Activity authenticates with Discord SDK and posts its OAuth code to `/activity/auth`.
- Activity reads the same account data returned by the backend.

- [ ] Replace purple styling with the same LEGACY green/teal/olive visual system.
- [ ] Add profile, points, inventory and social navigation.
- [ ] Preserve independent Activity use even when users are not in a voice channel.
- [ ] Handle authentication failure and missing Activity credentials cleanly.

### Task 7: Local verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Create: `.github/workflows/ci.yml`

- [ ] Document the exact local startup flow.
- [ ] Document Discord OAuth redirect registration for localhost.
- [ ] Add CI for backend tests and web/activity production builds.
- [ ] Verify repository contains no secrets.
- [ ] Run the full local test/build commands when a network-enabled runtime is available.

## Verification Commands

```bash
npm install
npm run test
npm run build
npm run dev
```

The local acceptance flow is: open the website -> click Discord login -> complete OAuth -> return to the website -> confirm `/api/me` shows the linked account -> type `legacy` in Discord -> confirm the same account data appears -> launch Activity and confirm the same account identity.
