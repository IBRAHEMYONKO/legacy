# LEGACY Social Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build real Discord identity sync, developer badge, points economy, titles, badges, store/inventory, lively web profile, and shared Discord-bot data.

**Architecture:** PGlite remains the local source of truth. Backend owns identity, economy, catalog, inventory and authorization; website and bot consume the same APIs.

**Tech Stack:** Node.js 24, Express, PGlite, discord.js, React/Vite.

**Spec:** `docs/superpowers/specs/2026-09-14-legacy-social-core-design.md`

## Global Constraints
- Local-first; no separate PostgreSQL installation.
- Backend is authoritative for points and inventory.
- Never expose bot token, OAuth secret, JWT secret or internal key to frontend.
- Preserve existing OAuth and core API compatibility.
- `legacy` remains the primary prefix command.

### Task 1: Database
**Files:** `database/schema.sql`, `backend/test/social-core.test.js`
- [ ] Add failing tests for roles, badges, titles, ownership and equipped items.
- [ ] Add normalized tables and indexes.
- [ ] Seed developer badge and starter catalog items idempotently.
- [ ] Run focused tests and commit `feat: add LEGACY social core schema`.

### Task 2: Discord identity
**Files:** `backend/src/server.js`, `database/schema.sql`, `backend/test/social-core.test.js`
- [ ] Test first-login creation and subsequent identity/avatar synchronization.
- [ ] Ensure `LEGACY_ADMIN_IDS` maps to developer role/badge.
- [ ] Extend `/api/me` with roles, badges, titles and equipped items.
- [ ] Run tests and commit `feat: sync Discord identity and developer profile`.

### Task 3: Points and purchases
**Files:** `backend/src/server.js`, `backend/src/extended-routes.js`, `backend/test/social-core.test.js`
- [ ] Test insufficient balance, successful purchase and atomic inventory grant.
- [ ] Add `GET /api/points/history`.
- [ ] Add `POST /api/shop/:itemId/purchase` as an atomic backend transaction.
- [ ] Add `POST /api/inventory/:itemId/equip` with ownership checks.
- [ ] Run tests and commit `feat: add real points and purchase transactions`.

### Task 4: Catalog and profile items
**Files:** `database/schema.sql`, `backend/src/server.js`, `backend/test/social-core.test.js`
- [ ] Seed developer, founder, developer and legend titles plus starter cosmetics.
- [ ] Add profile-item retrieval/equip APIs.
- [ ] Validate supported catalog types in admin creation.
- [ ] Run tests and commit `feat: seed LEGACY titles badges and cosmetics`.

### Task 5: Website
**Files:** `apps/web/src/main.jsx`, `apps/web/src/style.css`
- [ ] Replace placeholder identity with `/api/me` Discord identity.
- [ ] Add profile hero, avatar, username, developer badge, title, level and real points.
- [ ] Add badges, inventory, store categories and leaderboard highlights.
- [ ] Wire purchase/equip actions to backend and refresh state.
- [ ] Run `npm run build` and commit `feat: build LEGACY social dashboard`.

### Task 6: Discord bot integration
**Files:** `apps/bot/src/index.js`, `apps/bot/src/admin-ui.js`, `backend/test/bot-integration.test.js`
- [ ] Test internal-key authorization.
- [ ] Add a backend API client to the bot.
- [ ] Make `legacy` display real profile, points, titles, badges and inventory.
- [ ] Route admin points/catalog mutations through backend.
- [ ] Verify a change made from Discord appears on the website and commit `feat: connect LEGACY bot to shared economy`.

### Task 7: End-to-end verification
**Files:** affected files only if defects appear
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run dev` and verify API, bot, web and Activity start.
- [ ] Verify Discord avatar/name, developer badge, points, purchase, inventory and title.
- [ ] Verify Discord `legacy` shows the same data as the website.
- [ ] Verify secrets are not exposed to frontend or `.env.example`.
