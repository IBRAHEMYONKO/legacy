# LEGACY Unified Local Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LEGACY start the API, Discord bot, website, and Discord Activity from one Windows CMD command while keeping Discord as the immutable source of username, display name, and avatar in the website identity UI.

**Architecture:** The existing root launcher remains the single process supervisor. Development services run through npm workspaces and inherit the root environment. The web app resolves its API host from the browser hostname when the configured API points at localhost, allowing LAN access. Discord identity is read from the backend's linked Discord account and exposed to the frontend as the authoritative identity object; editable LEGACY profile fields remain separate.

**Tech Stack:** Node.js 24+, npm workspaces, CommonJS root launcher, React/Vite web app, Discord.js, PGlite/PostgreSQL-compatible backend.

**Spec:** `docs/superpowers/specs/2026-09-14-legacy-identity-economy-design.md`

## Global Constraints

- Discord is the authoritative source for username, global/display name, and avatar.
- LEGACY must not provide controls that edit Discord username, display name, or avatar.
- The website, bot, Activity, and backend share the same account/data model.
- Local development must start from one root CMD command.
- LAN development must bind web/API services appropriately; no hard-coded localhost-only browser API URL.
- Do not expose or commit Discord secrets.

---

### Task 1: Unified launcher

**Files:**
- Modify: `index.js`
- Modify: `package.json`

**Interfaces:**
- Produces one root `npm run dev` command that starts API, bot, web, and Activity.
- Existing `start` production command remains available.

- [ ] Verify the root development process list includes all four workspaces.
- [ ] Make child process startup robust on Windows and LAN development.
- [ ] Add a clear root startup summary with URLs.
- [ ] Keep graceful shutdown for all child processes.
- [ ] Verify `npm run dev` starts all four processes from the root.

### Task 2: Discord identity contract

**Files:**
- Inspect/modify: `backend/src/server.js`
- Inspect/modify: `backend/src/extended-routes.js`
- Modify: `apps/web/src/legacy-app.jsx`

**Interfaces:**
- `/api/me` provides a stable `discord` object containing Discord account ID, username, global/display name, and avatar URL.
- Frontend identity components consume `me.discord` only for Discord identity.

- [ ] Trace the existing `/api/me` response and Discord account storage.
- [ ] Return authoritative Discord identity fields from the linked account.
- [ ] Remove any UI path that lets users edit username/display name/avatar.
- [ ] Keep bio, banner, titles, badges, frames, backgrounds, points, and level as LEGACY data.
- [ ] Ensure a changed Discord avatar/name is reflected after the next account sync/login.

### Task 3: LAN web/API behavior

**Files:**
- Inspect/modify: `backend/src/server.js`
- Inspect/modify: `apps/web/src/legacy-app.jsx`
- Inspect/modify: `apps/web/src/legacy-app.css`

**Interfaces:**
- Browser opened through `http://<LAN-IP>:5173` reaches the API without attempting `localhost:4000` when the API is configured as localhost.

- [ ] Confirm Vite binds to `0.0.0.0`.
- [ ] Confirm API binds to a LAN-accessible host where required.
- [ ] Keep OAuth redirect behavior explicit and safe; do not invent Discord redirect URLs.
- [ ] Verify frontend API requests work from both localhost and LAN hostname.

### Task 4: Interactive website identity UI

**Files:**
- Modify: `apps/web/src/legacy-app.jsx`
- Modify: `apps/web/src/legacy-app.css`

**Interfaces:**
- Header, home identity card, profile card, and other user-facing identity surfaces use the same Discord identity object.

- [ ] Add clear Discord-linked indicator.
- [ ] Make avatar/name/username visually consistent across all pages.
- [ ] Preserve mouse-follow and hover interactions without interfering with buttons or accessibility.
- [ ] Ensure mobile navigation and interactive cards remain usable.

### Task 5: One-command documentation and verification

**Files:**
- Modify: `README.md`
- Test: root startup and workspace tests/builds.

- [ ] Document `npm run dev` as the only development startup command.
- [ ] Document localhost and LAN URLs.
- [ ] Run backend tests.
- [ ] Build web and Activity.
- [ ] Start root development supervisor and verify all four child services remain running.
- [ ] Confirm no secrets are added to tracked files.
