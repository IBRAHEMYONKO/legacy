# LEGACY Identity, Economy & Discord Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current prototype identity/economy behavior with a real Discord-backed profile, authoritative points ledger, titles, badges, store/inventory flow, and shared Discord-bot access.

**Architecture:** Keep `users` as the internal LEGACY identity and `discord_accounts.discord_id` as the canonical Discord identity. Put all economy mutations behind backend services/routes backed by the existing PGlite/PostgreSQL-compatible schema, then make the website and Discord bot consume those same backend operations. The first implementation phase is intentionally limited to identity/profile, points, titles/badges, inventory/store, and the corresponding bot UI so every delivered slice is testable before social features are layered on top.

**Tech Stack:** Node.js 24+, Express, PGlite/PostgreSQL-compatible SQL, discord.js 14, React/Vite, existing JWT/OAuth flow.

**Spec:** `docs/superpowers/specs/2026-09-14-legacy-identity-economy-design.md`

## Global Constraints

- Discord identity remains the source of truth for Discord username, global name, Discord ID, and avatar URL.
- `users.id` remains the stable internal LEGACY user ID.
- `point_transactions` remains an immutable ledger; no browser-supplied balance is trusted.
- Store prices/rewards are read server-side from `catalog_items`.
- Admin authorization is server-side and based on `LEGACY_ADMIN_IDS`.
- Discord client secrets and bot tokens never enter frontend code.
- The website, Activity, and Discord bot must consume the same backend data model.
- Existing OAuth behavior and existing backend tests must remain working.

---

### Task 1: Normalize Discord identity synchronization and profile response

**Files:**
- Modify: `backend/src/server.js`
- Modify: `database/schema.sql`
- Test: `backend/test/identity.test.js`

**Interfaces:**
- Produces `GET /api/me` with normalized fields: `id`, `discord_id`, `username`, `global_name`, `avatar_url`, `display_name`, `bio`, `banner_url`, `level`, `experience`, `premium_until`, `points`, `title`, `badges`, `admin`.
- Produces an OAuth upsert that updates Discord identity fields without overwriting LEGACY-owned profile fields.

- [ ] **Step 1: Add failing identity/profile tests**

Create tests that exercise the existing test database/API helpers and assert that an existing Discord account is updated with a changed `username`, `global_name`, and `avatar_url`, while its `bio` and banner remain unchanged. Add a second test asserting that `GET /api/me` exposes the normalized Discord identity fields and an integer/string-safe points value.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm --workspace backend test -- --runInBand`

Expected: the new identity assertions fail before the implementation is changed.

- [ ] **Step 3: Implement the normalized profile query**

Refactor the `/api/me` query in `backend/src/server.js` so it joins the user, Discord account, and profile records once and returns the normalized profile shape. Keep the Discord avatar URL from `discord_accounts` authoritative and keep profile-owned fields independent.

- [ ] **Step 4: Harden OAuth upsert**

Update `upsertDiscordUser` so both new and existing accounts synchronize Discord username/global name/avatar. For an existing user, do not replace `profiles.display_name`, `bio`, `banner_url`, level, experience, or premium state.

- [ ] **Step 5: Extend schema only where required**

If the selected-title reference or badge representation cannot be expressed safely with the existing schema, add the minimal foreign-key/index changes in `database/schema.sql`. Do not introduce a second user table.

- [ ] **Step 6: Run the focused tests again**

Run: `npm --workspace backend test -- --runInBand`

Expected: identity/profile tests pass and existing tests remain green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/server.js database/schema.sql backend/test/identity.test.js
git commit -m "feat: normalize discord-backed legacy profiles"
```

---

### Task 2: Build the authoritative points service and purchase transaction

**Files:**
- Create: `backend/src/economy.js`
- Modify: `backend/src/server.js`
- Modify: `database/schema.sql`
- Test: `backend/test/economy.test.js`

**Interfaces:**
- `getPoints(userId)` returns the current ledger sum as a non-negative integer.
- `adjustPoints({ userId, amount, reason, actorUserId })` records one immutable transaction and returns the new balance.
- `purchaseItem({ userId, itemId })` atomically validates the active catalog item, checks balance, records the purchase, records a negative point transaction, and grants inventory.

- [ ] **Step 1: Write failing tests for balance and spend rules**

Cover: zero balance, positive grant, negative spend, insufficient funds rejection, missing reason rejection, and a successful purchase that changes both the ledger and inventory.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm --workspace backend test -- --runInBand`

Expected: economy tests fail because the service functions/routes do not yet implement the required transaction semantics.

- [ ] **Step 3: Implement `getPoints` and `adjustPoints`**

Use the ledger sum as the source of truth. Reject a spend when `currentBalance + amount < 0`. Store `reason` and `actorUserId` on every adjustment.

- [ ] **Step 4: Implement `purchaseItem` as one transaction**

Use the database transaction/client API already provided by `backend/src/db.js`. Re-read the catalog item server-side, reject inactive/missing items, calculate the authoritative balance, insert the purchase, insert the negative ledger transaction, and upsert inventory before commit.

- [ ] **Step 5: Add public and internal economy routes**

Add authenticated endpoints for current balance/recent transactions and purchasing an item. Add the corresponding internal route used by the bot. Do not expose an endpoint that accepts a target balance.

- [ ] **Step 6: Run economy tests**

Run: `npm --workspace backend test -- --runInBand`

Expected: all economy tests pass, including persistence after a new database connection.

- [ ] **Step 7: Commit**

```bash
git add backend/src/economy.js backend/src/server.js database/schema.sql backend/test/economy.test.js
git commit -m "feat: add authoritative legacy points economy"
```

---

### Task 3: Add real titles, badges, seed catalog, and selection rules

**Files:**
- Create: `backend/src/catalog.js`
- Modify: `backend/src/server.js`
- Modify: `database/schema.sql`
- Test: `backend/test/catalog.test.js`

**Interfaces:**
- `listCatalog({ type, activeOnly })` returns catalog items.
- `grantItem({ userId, itemId, actorUserId, reason })` grants inventory without charging points.
- `selectTitle({ userId, itemId })` selects an owned title and rejects non-title/unowned items.
- `getPresentationItems(userId)` returns selected title and visible badges.

- [ ] **Step 1: Add failing tests for title ownership/selection and privileged badges**

Assert that a user cannot select a title they do not own, can select an owned title, and receives the developer badge for a configured developer identity without purchasing it.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm --workspace backend test -- --runInBand`

Expected: catalog tests fail before the service exists.

- [ ] **Step 3: Add the minimal schema for presentation state**

Add a profile-selected-title reference and a normalized badge model if needed. Preserve catalog/inventory ownership through foreign keys. Ensure deleting a catalog item cannot silently invalidate a selected title.

- [ ] **Step 4: Implement catalog/presentation services**

Implement title selection, grants, and presentation aggregation. Use metadata for cosmetic display properties rather than hard-coding every UI field into SQL columns.

- [ ] **Step 5: Seed initial LEGACY catalog data**

Create a repeatable seed script or startup migration that inserts the initial titles and non-purchasable privileged badges. The seed must be idempotent and must not duplicate items on restart.

- [ ] **Step 6: Extend API responses**

Include selected title and badges in `/api/me` and expose authenticated endpoints for inventory, title selection, and presentation data. Add internal equivalents for the bot.

- [ ] **Step 7: Run catalog tests and commit**

Run: `npm --workspace backend test -- --runInBand`

Expected: catalog tests and all existing backend tests pass.

```bash
git add backend/src/catalog.js backend/src/server.js database/schema.sql backend/test/catalog.test.js
 git commit -m "feat: add legacy titles badges and catalog presentation"
```

---

### Task 4: Replace the website prototype identity/economy UI with live data

**Files:**
- Modify: `apps/web/src/main.jsx`
- Modify: `apps/web/src/style.css`
- Test: `apps/web/src` via `npm --workspace apps/web run build`

**Interfaces:**
- The website reads the normalized `/api/me` response and renders Discord identity, points, title, badges, level, and premium state.
- Store purchase and title-selection controls call backend endpoints and refresh local state from the API response.

- [ ] **Step 1: Identify and isolate the current placeholder identity/economy state**

Replace hard-coded avatar/name/points/title/badge values with the existing authenticated API request flow. Keep the current OAuth token storage behavior intact.

- [ ] **Step 2: Add the live profile header**

Render Discord avatar, global display name, username, Discord ID-derived profile identity, selected title, badges, level, and points. Use graceful fallbacks while the API request is loading.

- [ ] **Step 3: Add a live store and inventory view**

Render catalog items from `/api/shop`, inventory from `/api/inventory`, and wire purchases to the authenticated purchase endpoint. Disable a purchase button during the request and show the returned authoritative balance rather than locally subtracting a guessed amount.

- [ ] **Step 4: Add title selection and badge presentation**

Allow owned titles to be selected through the API and display privileged developer/founder badges distinctly from titles.

- [ ] **Step 5: Improve visual hierarchy and motion**

Use the existing stylesheet as the base, adding richer cards, profile hero, points indicator, badges, store states, loading states, and subtle transitions. Do not invent fake metrics to fill empty UI.

- [ ] **Step 6: Build the website**

Run: `npm --workspace apps/web run build`

Expected: Vite production build completes successfully.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/main.jsx apps/web/src/style.css
git commit -m "feat: make legacy profile and store UI live"
```

---

### Task 5: Make the Discord `legacy` command consume the same live profile/economy services

**Files:**
- Modify: `apps/bot/src/index.js`
- Modify: `apps/bot/src/admin-ui.js`
- Modify: `backend/src/server.js`
- Test: `apps/bot` startup plus backend integration tests

**Interfaces:**
- Normal `legacy` dashboard reads the same profile, points, inventory, title, and badges as the website.
- Admin `legacy` dashboard can grant/adjust points, create catalog entries, inspect inventory, and inspect audit logs using internal backend routes.

- [ ] **Step 1: Add backend internal presentation endpoint**

Expose a single internal profile endpoint returning the same normalized presentation shape used by `/api/me`, authenticated by `LEGACY_INTERNAL_KEY` and additionally constrained by the requesting Discord ID where appropriate.

- [ ] **Step 2: Add failing bot integration expectations**

Verify that a Discord user who has logged into LEGACY can open `legacy`, see their Discord identity, current points, selected title, and badges. Verify that admin point changes are reflected by the next profile request.

- [ ] **Step 3: Update normal bot dashboard**

Replace placeholder responses with live API reads. Add buttons for profile, points, store, inventory, titles, and badges. Keep the prefix command as exactly `legacy`.

- [ ] **Step 4: Add live store purchase flow**

Use Discord select menus/buttons to display active catalog items and call the backend purchase endpoint. Confirm the purchase result and updated balance in the ephemeral response.

- [ ] **Step 5: Add developer badge/title presentation**

Render the privileged developer identity in the bot dashboard without allowing a normal user to self-assign it.

- [ ] **Step 6: Preserve admin operations**

Keep server-side admin checks and wire the admin UI to the same economy/catalog services. Never trust an admin flag supplied by the Discord interaction payload.

- [ ] **Step 7: Run backend tests and bot startup**

Run: `npm test`

Then run: `npm --workspace apps/bot run dev`

Expected: bot logs in, `legacy` responds, and backend mutations are reflected on the website without a second database.

- [ ] **Step 8: Commit**

```bash
git add apps/bot/src/index.js apps/bot/src/admin-ui.js backend/src/server.js
 git commit -m "feat: sync discord legacy dashboard with shared economy"
```

---

### Task 6: Verification, migration safety, and local developer documentation

**Files:**
- Modify: `README.md`
- Modify: `.env.example` only if a new non-secret variable is required
- Test: `backend/test/*`, website build, bot startup

- [ ] **Step 1: Run the complete backend test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Build web and Activity**

Run: `npm run build`

Expected: both frontend builds succeed.

- [ ] **Step 3: Run the full local stack**

Run: `npm run dev`

Verify API health, Discord OAuth login, profile synchronization, website points, store purchase, title selection, and bot `legacy` access.

- [ ] **Step 4: Restart and verify persistence**

Stop the local stack, start it again, and verify that the user, points ledger, inventory, title selection, and badges remain intact in the PGlite data directory.

- [ ] **Step 5: Verify security boundaries**

Confirm that frontend bundles contain no Discord client secret, bot token, internal key, or JWT signing secret. Confirm admin routes reject a normal user.

- [ ] **Step 6: Document the new local flow**

Update README with the local login, seed/catalog behavior, points/store behavior, and Discord `legacy` command behavior. Do not document real secrets.

- [ ] **Step 7: Commit**

```bash
git add README.md .env.example
 git commit -m "docs: document legacy live identity and economy flow"
```

## Execution order and checkpoints

Tasks 1-3 form the backend foundation and should be reviewed after each commit. Task 4 can then be built independently against the stable API. Task 5 is the cross-surface integration checkpoint. Task 6 is the final verification gate.

## Out of scope for this plan

Social feed, permanent video storage, Stories, comments/replies, DMs, groups, tasks/missions, dynamic redeem-code management, Premium purchase logic, upload/object storage, and Discord Activity-specific UX are subsequent plans. They will reuse the identity/economy interfaces created here rather than creating duplicate user or points systems.
