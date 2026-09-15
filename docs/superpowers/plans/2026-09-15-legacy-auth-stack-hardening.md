# LEGACY Auth & Stack Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LEGACY authentication, required Discord guild membership, Web/Activity startup, and bot integrations reliable and observable without changing the wider social-platform scope.

**Architecture:** Discord remains the canonical identity provider. The backend validates OAuth, persists the Discord identity, enforces required guild membership, and issues the LEGACY JWT. The Web and Activity clients only consume a successful session or display a structured authentication error. The launcher starts API first, waits for health, then starts Web/Activity and optionally Cloudflare.

**Tech Stack:** Node.js 24+, Express, discord.js 14.27+, PGlite/PostgreSQL adapter, React, Vite, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-legacy-auth-stack-hardening-design.md`

## Global Constraints

- Discord is the canonical identity source.
- Required scopes are `identify guilds.join`.
- Local API remains `http://localhost:4000`.
- Local website remains `http://localhost:5173`.
- Local Activity remains `http://localhost:5174`.
- Local database remains embedded PGlite unless explicitly changed later.
- OAuth secrets and access tokens must never be logged or returned.
- The normal Discord command remains exactly `legacy`.
- Admin authorization remains based on `LEGACY_ADMIN_IDS`.
- Internal bot/API calls remain protected by `LEGACY_INTERNAL_KEY`.

---

### Task 1: Make OAuth failures explicit and safe

**Files:**
- Create: `backend/src/oauth-errors.js`
- Modify: `backend/src/server.js`
- Modify: `apps/web/src/legacy-app.jsx`
- Test: `backend/test/oauth-errors.test.js`

**Interfaces:**
- `formatOAuthFailure(error)` returns a user-safe Arabic message while preserving a useful category from the original error.
- `readOAuthResult(locationLike)` returns `{ token, error }` from callback query parameters without throwing.

- [ ] **Step 1: Write failing OAuth error tests**

Add tests asserting that guild-add failures expose their category, unknown failures use a safe fallback, and callback parsing distinguishes `token` from `auth_error`.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatOAuthFailure } = require('../src/oauth-errors');

test('formats a guild failure with an actionable category', () => {
  assert.equal(
    formatOAuthFailure(new Error('Discord رفض إضافة العضو (403) — Missing Permissions [Discord 50013]')),
    'تعذر إكمال تسجيل Discord: Discord رفض إضافة العضو (403) — Missing Permissions [Discord 50013]'
  );
});

test('uses a safe fallback for unknown OAuth failures', () => {
  assert.equal(formatOAuthFailure(null), 'تعذر إكمال تسجيل Discord. حاول مرة أخرى.');
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npm --workspace backend test -- oauth-errors.test.js`

Expected: FAIL because the formatting helper is not implemented yet or its expected behavior is absent.

- [ ] **Step 3: Implement the minimal formatting helper**

Implement `formatOAuthFailure()` so it strips accidental token-like data, keeps the real Discord status/message, and prepends one consistent Arabic prefix.

- [ ] **Step 4: Add frontend callback parsing test**

Create a small pure helper test for `readOAuthResult()` covering `?token=abc`, `?auth_error=...`, and an empty query.

- [ ] **Step 5: Run the test and verify GREEN**

Run: `npm --workspace backend test -- oauth-errors.test.js`

Expected: PASS.

- [ ] **Step 6: Wire the backend callback to `formatOAuthFailure()`**

Replace the fixed generic callback error string with the formatted failure. Keep access tokens, OAuth codes, and secrets out of logs.

- [ ] **Step 7: Wire the Web app to consume `auth_error`**

Read `auth_error` during startup, clear any stale `legacy_token`, show the authentication error state, and remove both callback query parameters from browser history after processing.

- [ ] **Step 8: Run all backend tests**

Run: `npm test`

Expected: all backend tests PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/oauth-errors.js backend/src/server.js apps/web/src/legacy-app.jsx backend/test/oauth-errors.test.js
git commit -m "fix: expose Discord OAuth failures safely"
```

---

### Task 2: Harden required Discord guild membership

**Files:**
- Modify: `backend/src/discord-guild.js`
- Modify: `backend/src/server.js`
- Test: `backend/test/discord-guild.test.js`

**Interfaces:**
- `resolveGuildFromInvite(fetchImpl)` resolves `{ id, name, invite }`.
- `getBotGuildMember(guildId, userId, fetchImpl)` resolves `true`/`false` or throws a categorized error.
- `joinLegacyGuild(userId, oauthAccessToken, fetchImpl)` adds the user when absent and verifies membership before returning.

- [ ] **Step 1: Write failing tests for existing member, add success, and API failure mapping**

Use an injected fetch implementation so tests exercise the actual request-building logic without contacting Discord.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getBotGuildMember, joinLegacyGuild } = require('../src/discord-guild');

test('returns true when the user is already a member', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/members/')) return new Response('', { status: 200 });
    return new Response(JSON.stringify({ guild: { id: 'guild-1', name: 'LEGACY' } }), { status: 200 });
  };
  assert.equal(await getBotGuildMember('guild-1', 'user-1', fetchImpl), true);
  assert.equal(calls.length, 1);
});

test('adds an absent user and verifies membership again', async () => {
  let memberChecks = 0;
  const fetchImpl = async (url, options = {}) => {
    if (url.includes('/invites/')) return new Response(JSON.stringify({ guild: { id: 'guild-1', name: 'LEGACY' } }), { status: 200 });
    if (url.includes('/members/')) {
      memberChecks += 1;
      if (memberChecks === 1) return new Response('', { status: 404 });
      assert.equal(options.method, 'PUT');
      const body = JSON.parse(options.body);
      assert.equal(body.access_token, 'oauth-token');
      return new Response('', { status: 204 });
    }
    throw new Error('unexpected URL');
  };
  const result = await joinLegacyGuild('user-1', 'oauth-token', fetchImpl);
  assert.equal(result.id, 'guild-1');
  assert.equal(memberChecks, 2);
});
```

- [ ] **Step 2: Run targeted tests and verify RED**

Run: `npm --workspace backend test -- discord-guild.test.js`

Expected: FAIL because the current functions do not accept an injected fetch and do not perform a post-add membership check.

- [ ] **Step 3: Implement dependency injection and post-add verification**

Pass `fetchImpl = global.fetch` through the helper signatures. After a successful PUT, call `getBotGuildMember()` again and throw a categorized error if membership is still false.

- [ ] **Step 4: Improve application-mismatch and permission errors**

Map 401/403 responses to messages that identify OAuth validity, missing scope, bot/app mismatch, or Discord permission problems without exposing secrets.

- [ ] **Step 5: Run targeted tests and verify GREEN**

Run: `npm --workspace backend test -- discord-guild.test.js`

Expected: PASS.

- [ ] **Step 6: Keep the callback flow transactional**

Ensure `upsertDiscordUser()` may persist the Discord account before guild addition, but the JWT is still issued only after membership verification succeeds.

- [ ] **Step 7: Run all backend tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/discord-guild.js backend/src/server.js backend/test/discord-guild.test.js
git commit -m "fix: harden required Discord guild membership"
```

---

### Task 3: Make OAuth configuration and Activity routes consistent

**Files:**
- Modify: `backend/src/server.js`
- Modify: `.env.example`
- Modify: `apps/activity/src/main.jsx`
- Test: `backend/test/oauth-config.test.js`

**Interfaces:**
- `getDiscordOAuthConfig(env)` returns normalized website/activity redirect URIs and client configuration.
- Website and Activity must use the same backend OAuth contract, with Activity posting its code to `/activity/auth`.

- [ ] **Step 1: Write failing configuration tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getDiscordOAuthConfig } = require('../src/oauth-config');

test('uses explicit activity redirect URI when configured', () => {
  const config = getDiscordOAuthConfig({
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'secret',
    DISCORD_REDIRECT_URI: 'http://localhost:4000/auth/discord/callback',
    DISCORD_ACTIVITY_REDIRECT_URI: 'http://localhost:4000/activity/auth'
  });
  assert.equal(config.activityRedirectUri, 'http://localhost:4000/activity/auth');
});
```

- [ ] **Step 2: Run targeted test and verify RED**

Run: `npm --workspace backend test -- oauth-config.test.js`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the configuration helper**

Normalize values once and reuse them in website and Activity auth flows.

- [ ] **Step 4: Align Activity frontend flow**

Remove any reference to `/activity/callback` when the client is actually posting to `/activity/auth`.

- [ ] **Step 5: Run targeted and full tests**

Run: `npm --workspace backend test -- oauth-config.test.js && npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/oauth-config.js backend/src/server.js backend/test/oauth-config.test.js .env.example apps/activity/src/main.jsx
git commit -m "fix: align website and Activity OAuth configuration"
```

---

### Task 4: Clean launcher and Vite startup behavior

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/activity/package.json`
- Modify: `index.js`
- Modify: `apps/web/vite.config.js`
- Modify: `apps/activity/vite.config.js`
- Test: `backend/test/service-ready.test.js`

**Interfaces:**
- Root `npm run dev` remains the single local startup command.
- Vite receives `--host` and `--port` exactly once.

- [ ] **Step 1: Add a launcher regression assertion**

Extend the readiness test with a small pure helper assertion for a generated Vite command containing exactly one `--host` and one `--port`.

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `npm --workspace backend test -- service-ready.test.js`

Expected: FAIL if the launcher still contains duplicate Vite flags.

- [ ] **Step 3: Remove duplicate CLI ownership**

Keep host/port selection in the root launcher and remove duplicated defaults from workspace scripts, or keep the workspace scripts canonical and stop appending the same arguments from the root. Use one consistent ownership model.

- [ ] **Step 4: Keep API readiness gating**

Retain the existing health polling before starting Web and Activity. Do not replace it with an arbitrary sleep.

- [ ] **Step 5: Run test and full build**

Run: `npm --workspace backend test -- service-ready.test.js && npm run build`

Expected: PASS and successful Web/Activity production builds.

- [ ] **Step 6: Commit**

```bash
git add index.js apps/web/package.json apps/activity/package.json apps/web/vite.config.js apps/activity/vite.config.js backend/test/service-ready.test.js
git commit -m "fix: stabilize one-command LEGACY startup"
```

---

### Task 5: Remove duplicate/dead Discord admin UI paths

**Files:**
- Modify: `apps/bot/src/index.js`
- Modify: `apps/bot/src/admin.js`
- Delete or isolate: `apps/bot/src/admin-ui.js`
- Test: `apps/bot/test/index.test.js`

**Interfaces:**
- One active implementation owns each `legacy:*` admin interaction ID.
- Normal user command remains exact `legacy`.

- [ ] **Step 1: Write a regression test for the active admin surface**

Assert that the selected interaction IDs in `admin.js` are the only active admin handlers and that `legacy` remains an exact command.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm --workspace apps/bot test`

Expected: FAIL if duplicate handlers or stale module expectations remain.

- [ ] **Step 3: Consolidate admin handlers**

Keep `admin.js` as the single admin interaction implementation because `index.js` imports and invokes it directly. Remove the unused `admin-ui.js` path or reduce it to a documented compatibility shim with no registered listeners.

- [ ] **Step 4: Verify internal API contracts**

Confirm all bot internal endpoints use `x-legacy-internal-key` and that target Discord IDs are passed consistently.

- [ ] **Step 5: Run bot and backend tests**

Run: `npm --workspace apps/bot test && npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/bot/src/index.js apps/bot/src/admin.js apps/bot/test/index.test.js
git rm apps/bot/src/admin-ui.js
git commit -m "refactor: consolidate LEGACY Discord admin UI"
```

---

### Task 6: Verify end-to-end startup, authentication, and production build

**Files:**
- Modify only files required by failed verification from Tasks 1-5.
- Test: existing unit suites and CI workflow.

- [ ] **Step 1: Install dependencies from the repository lock state**

Run: `npm install`

Expected: dependency install completes without unresolved peer or workspace errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test && npm --workspace apps/bot test`

Expected: all tests PASS.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Web and Activity both build successfully.

- [ ] **Step 4: Start the complete local stack**

Run: `npm run dev`

Expected startup ordering:

```text
[LEGACY:api] started
[LEGACY:core] waiting for API health check...
LEGACY API listening on :4000
[LEGACY:core] API is ready; starting web and Activity
[LEGACY:bot] ONLINE as ...
```

Expected: no Vite `ECONNREFUSED` caused by frontend startup racing the API and no duplicate Vite host/port flags.

- [ ] **Step 5: Verify local website auth behavior**

Open `http://localhost:5173`, start Discord login, and confirm that success stores a token and loads `/api/me`. On failure, confirm the page displays the real categorized OAuth reason instead of returning silently to the landing page.

- [ ] **Step 6: Verify mandatory guild membership path**

Use the configured LEGACY invite and confirm an already-member account continues without a duplicate add request. For an absent account, confirm Add Guild Member is attempted and membership is checked before token issuance.

- [ ] **Step 7: Verify Activity route consistency**

Confirm the Activity client posts its OAuth code to `/activity/auth` and receives the same canonical LEGACY identity/session contract.

- [ ] **Step 8: Verify CI workflow**

Check the GitHub Actions result for the final commit and require a green workflow before claiming completion.

- [ ] **Step 9: Commit any verification-only fixes**

```bash
git add .
git commit -m "chore: finalize LEGACY auth stack verification"
```
