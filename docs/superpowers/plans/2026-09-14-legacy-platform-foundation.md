# LEGACY Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the majority of the LEGACY platform foundation so Discord, web, and Activity share one backend, account, economy, inventory, catalog, social, and administration system, while keeping the normal Discord experience centered on the single `legacy` command.

**Architecture:** A monorepo with a Node.js backend/API as the source of truth, a discord.js bot client, and separate web/activity clients consuming the same API. PostgreSQL stores relational state; object storage handles profile media; shared modules define contracts and UI/domain constants.

**Tech Stack:** Node.js 24, JavaScript, discord.js 14.x, Fastify, PostgreSQL/Supabase, React-based web/activity clients, WebSocket-based realtime layer, object storage for media.

**Spec:** `docs/superpowers/specs/2026-09-14-legacy-platform-design.md`

## Global Constraints

- Normal users have one Discord entry point: `legacy`.
- Profile, subscription, points, inventory, shop, leaderboard, social, and account settings are dashboard actions, not separate normal-user commands.
- Administration is permission-gated and can expose the large Discord control surface.
- Bot, website, and Activity share one backend/database/account state.
- Economy changes must be auditable through transactions.
- Catalog content must be data-driven rather than source-code hardcoded.
- Private user data must not be exposed in public dashboard messages.
- LEGACY cosmetic profile settings do not claim to modify the user's actual Discord profile.

---

### Task 1: Repository foundation

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `apps/bot/package.json`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`
- Create: `apps/activity/package.json`
- Create: `shared/constants.js`
- Create: `shared/errors.js`

**Interfaces:**
- Root scripts start/lint/test/build the individual applications.
- Shared constants define dashboard IDs, item types, and permission names.

- [ ] Step 1: Add root package metadata and workspace scripts.
- [ ] Step 2: Add environment variable documentation without real secrets.
- [ ] Step 3: Add shared domain constants and typed error codes.
- [ ] Step 4: Add minimal README describing local startup and architecture.
- [ ] Step 5: Run `npm install` and verify workspace resolution.
- [ ] Step 6: Commit foundation.

### Task 2: Database schema and migrations

**Files:**
- Create: `database/schema.sql`
- Create: `database/seed.sql`
- Create: `backend/db/client.js`
- Create: `backend/db/migrate.js`
- Create: `backend/db/repositories/users.js`
- Create: `backend/db/repositories/economy.js`
- Create: `backend/db/repositories/catalog.js`
- Create: `backend/db/repositories/inventory.js`
- Create: `backend/db/repositories/audit.js`

**Interfaces:**
- `users.getOrCreateByDiscordId(discordId)` returns a user record.
- `economy.addPoints(userId, amount, reason, actorId)` and `economy.removePoints(...)` write transaction records.
- `catalog.listActiveItems(type)` returns active catalog items.
- `inventory.grantItem(userId, itemId, source, actorId)` records ownership.
- `audit.log(actorId, action, targetType, targetId, metadata)` records administrative changes.

- [ ] Step 1: Create tables for users, Discord accounts, profiles, points, catalog, inventory, purchases, premium, codes, social, groups, conversations, notifications, admin permissions, and audit logs.
- [ ] Step 2: Add unique constraints for Discord identity, item ownership, code redemption, and friendship/follow relationships.
- [ ] Step 3: Add indexes for user lookup, inventory, transactions, messages, codes, and audit history.
- [ ] Step 4: Seed initial safe catalog examples and admin permission definitions.
- [ ] Step 5: Run schema validation against a local PostgreSQL database.
- [ ] Step 6: Commit database foundation.

### Task 3: API core and authentication

**Files:**
- Create: `apps/api/src/server.js`
- Create: `apps/api/src/config.js`
- Create: `apps/api/src/plugins/auth.js`
- Create: `apps/api/src/routes/health.js`
- Create: `apps/api/src/routes/auth.js`
- Create: `apps/api/src/services/authService.js`
- Create: `apps/api/src/services/userService.js`

**Interfaces:**
- `GET /health` returns service status.
- `GET /auth/discord/start` begins Discord OAuth2.
- `GET /auth/discord/callback` creates/links the LEGACY account and session.
- `GET /api/me` returns the authenticated LEGACY account and profile summary.

- [ ] Step 1: Write API health and authentication tests.
- [ ] Step 2: Implement Fastify server and configuration validation.
- [ ] Step 3: Implement Discord OAuth2 callback and account linking.
- [ ] Step 4: Implement secure session handling with httpOnly cookies.
- [ ] Step 5: Run API tests and verify unauthenticated/authenticated paths.
- [ ] Step 6: Commit API authentication.

### Task 4: Core profile, points, inventory, and shop API

**Files:**
- Create: `apps/api/src/routes/profile.js`
- Create: `apps/api/src/routes/economy.js`
- Create: `apps/api/src/routes/inventory.js`
- Create: `apps/api/src/routes/shop.js`
- Create: `apps/api/src/services/profileService.js`
- Create: `apps/api/src/services/economyService.js`
- Create: `apps/api/src/services/inventoryService.js`
- Create: `apps/api/src/services/shopService.js`

**Interfaces:**
- `GET/PATCH /api/profile`
- `GET /api/points`
- `GET /api/inventory`
- `GET /api/shop`
- `POST /api/shop/purchase`

- [ ] Step 1: Add service tests for profile updates, point transactions, inventory grants, and purchases.
- [ ] Step 2: Implement profile retrieval/update with ownership checks.
- [ ] Step 3: Implement transactional point spending and shop purchases.
- [ ] Step 4: Implement inventory listing and item ownership checks.
- [ ] Step 5: Run tests including duplicate purchase and insufficient-point cases.
- [ ] Step 6: Commit core user economy.

### Task 5: Premium, codes, notifications, and leaderboards API

**Files:**
- Create: `apps/api/src/routes/premium.js`
- Create: `apps/api/src/routes/codes.js`
- Create: `apps/api/src/routes/notifications.js`
- Create: `apps/api/src/routes/leaderboards.js`
- Create: `apps/api/src/services/premiumService.js`
- Create: `apps/api/src/services/codeService.js`
- Create: `apps/api/src/services/leaderboardService.js`

**Interfaces:**
- `GET /api/premium`
- `GET /api/notifications`
- `GET /api/leaderboards/:type`
- `POST /api/codes/redeem`
- Admin-only code creation endpoints are isolated from normal user redemption.

- [ ] Step 1: Test code limits, expiry, duplicate redemption, and multi-reward redemption.
- [ ] Step 2: Implement Premium entitlement reads and admin grants/revokes.
- [ ] Step 3: Implement atomic code redemption and reward delivery.
- [ ] Step 4: Implement notifications and leaderboard queries.
- [ ] Step 5: Run API tests.
- [ ] Step 6: Commit rewards and progression.

### Task 6: Discord `legacy` user dashboard

**Files:**
- Create: `apps/bot/src/index.js`
- Create: `apps/bot/src/config.js`
- Create: `apps/bot/src/apiClient.js`
- Create: `apps/bot/src/commands/legacy.js`
- Create: `apps/bot/src/ui/userDashboard.js`
- Create: `apps/bot/src/ui/components.js`
- Create: `apps/bot/src/handlers/interactions.js`

**Interfaces:**
- Prefix parser recognizes exactly `legacy` as the normal dashboard entry point.
- `userDashboard.render(userId)` returns the normal dashboard embed/components.
- Interaction routing maps dashboard IDs to profile, premium, points, inventory, shop, leaderboard, social, and settings views.

- [ ] Step 1: Test command recognition and permission-aware routing.
- [ ] Step 2: Implement bot startup and prefix message handler.
- [ ] Step 3: Implement the normal-user dashboard with buttons/select menus.
- [ ] Step 4: Implement profile, subscription, points, inventory, shop, and leaderboard views.
- [ ] Step 5: Ensure sensitive views reply privately through interaction responses.
- [ ] Step 6: Run bot tests and commit the user dashboard.

### Task 7: Discord administration dashboard

**Files:**
- Create: `apps/bot/src/ui/adminDashboard.js`
- Create: `apps/bot/src/ui/adminMenus.js`
- Create: `apps/bot/src/services/adminApi.js`
- Create: `apps/api/src/routes/admin/users.js`
- Create: `apps/api/src/routes/admin/economy.js`
- Create: `apps/api/src/routes/admin/catalog.js`
- Create: `apps/api/src/routes/admin/codes.js`
- Create: `apps/api/src/routes/admin/audit.js`

**Interfaces:**
- `adminDashboard.render(adminId)` is only callable after server-side permission validation.
- Admin endpoints validate both actor identity and permission before mutation.
- Every points, inventory, Premium, catalog, and code mutation writes an audit record.

- [ ] Step 1: Test admin authorization and audit creation.
- [ ] Step 2: Implement admin dashboard routing.
- [ ] Step 3: Implement user search/profile inspection.
- [ ] Step 4: Implement points, inventory, Premium, catalog, and code management.
- [ ] Step 5: Implement audit log search.
- [ ] Step 6: Run authorization tests and commit administration.

### Task 8: Media uploads and profile customization

**Files:**
- Create: `apps/api/src/routes/media.js`
- Create: `apps/api/src/services/mediaService.js`
- Create: `apps/api/src/routes/customization.js`
- Create: `apps/bot/src/ui/customization.js`

**Interfaces:**
- `POST /api/media/upload-url` authorizes a user to upload owned profile media.
- `GET /api/profile/customization` returns active customization.
- `PATCH /api/profile/customization` selects owned cosmetics.

- [ ] Step 1: Test ownership and media validation rules.
- [ ] Step 2: Implement signed object-storage upload flow.
- [ ] Step 3: Implement profile banner/avatar/customization selection.
- [ ] Step 4: Add administration controls for granting/removing cosmetics.
- [ ] Step 5: Run media/security tests and commit customization.

### Task 9: Social, groups, chat, and notifications

**Files:**
- Create: `apps/api/src/routes/social.js`
- Create: `apps/api/src/routes/groups.js`
- Create: `apps/api/src/routes/chat.js`
- Create: `apps/api/src/services/socialService.js`
- Create: `apps/api/src/services/groupService.js`
- Create: `apps/api/src/services/chatService.js`
- Create: `apps/api/src/realtime/socket.js`

**Interfaces:**
- Friend/follow/block/mute operations enforce server-side privacy rules.
- Group membership has roles and permissions.
- Conversations expose paginated messages and realtime events.

- [ ] Step 1: Test block/mute/privacy behavior and group authorization.
- [ ] Step 2: Implement friendship/following and notifications.
- [ ] Step 3: Implement groups and role permissions.
- [ ] Step 4: Implement conversations and WebSocket events.
- [ ] Step 5: Run integration tests for blocked users and unauthorized group actions.
- [ ] Step 6: Commit social layer.

### Task 10: Website client

**Files:**
- Create: `apps/web/src/main.jsx`
- Create: `apps/web/src/App.jsx`
- Create: `apps/web/src/api.js`
- Create: `apps/web/src/pages/Profile.jsx`
- Create: `apps/web/src/pages/Shop.jsx`
- Create: `apps/web/src/pages/Inventory.jsx`
- Create: `apps/web/src/pages/Leaderboard.jsx`
- Create: `apps/web/src/pages/Social.jsx`
- Create: `apps/web/src/components/Navigation.jsx`
- Create: `apps/web/src/components/ProfileCard.jsx`

- [ ] Step 1: Add frontend smoke tests for authentication and protected navigation.
- [ ] Step 2: Build responsive application shell.
- [ ] Step 3: Connect profile, points, inventory, shop, Premium, and leaderboard APIs.
- [ ] Step 4: Connect social/chat APIs and realtime events.
- [ ] Step 5: Run production build and browser smoke tests.
- [ ] Step 6: Commit website client.

### Task 11: Discord Activity client

**Files:**
- Create: `apps/activity/src/main.jsx`
- Create: `apps/activity/src/App.jsx`
- Create: `apps/activity/src/discord.js`
- Create: `apps/activity/src/api.js`
- Create: `apps/activity/src/pages/Home.jsx`
- Create: `apps/activity/src/pages/Profile.jsx`
- Create: `apps/activity/src/pages/Chat.jsx`
- Create: `apps/activity/src/pages/Groups.jsx`

- [ ] Step 1: Add Activity client smoke tests for authenticated boot and API access.
- [ ] Step 2: Integrate the current Discord Activity/Embedded App authentication flow required by the platform.
- [ ] Step 3: Connect the same profile, economy, inventory, social, and chat APIs.
- [ ] Step 4: Verify that Activity users remain independent from voice membership while sharing server/account state.
- [ ] Step 5: Run production build and Activity smoke tests.
- [ ] Step 6: Commit Activity client.

### Task 12: Integration, security, deployment, and documentation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/architecture.md`
- Create: `docs/deployment.md`
- Create: `docs/admin-guide.md`
- Modify: `README.md`

- [ ] Step 1: Add CI for tests and production builds.
- [ ] Step 2: Add API rate limits, permission checks, input validation, and safe error handling.
- [ ] Step 3: Verify no secrets are committed and environment configuration is documented.
- [ ] Step 4: Document deployment for API, web, Activity, PostgreSQL, and object storage.
- [ ] Step 5: Run the complete test suite and all production builds.
- [ ] Step 6: Commit integration and documentation.
