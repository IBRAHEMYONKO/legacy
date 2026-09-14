# Local Embedded Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let LEGACY run locally with a persistent embedded PostgreSQL-compatible database without requiring a separate PostgreSQL installation.

**Architecture:** Replace the local `pg` connection pool with PGlite, which runs PostgreSQL in-process and persists its data under the backend workspace. Keep the existing SQL schema and route SQL largely unchanged so production can continue using PostgreSQL/Supabase later. Database initialization will be automatic on backend startup.

**Tech Stack:** Node.js >=24, Express 5, PGlite, existing PostgreSQL SQL schema, npm workspaces.

**Spec:** Local LEGACY development should not require a separately installed PostgreSQL server; data should persist across local restarts; existing API route contracts should remain unchanged.

## Global Constraints

- Node.js >=24 remains required.
- Production PostgreSQL/Supabase compatibility must remain possible.
- No Discord secrets are committed to the repository.
- Existing API routes and frontend contracts must remain unchanged.
- Local database files must be ignored by Git.

---

### Task 1: Add PGlite dependency and local database configuration

**Files:**
- Modify: `backend/package.json`
- Modify: `.gitignore`
- Modify: `.env.example`

**Interfaces:**
- Backend gains `@electric-sql/pglite`.
- `LEGACY_DB_MODE=local` selects the embedded database for local development.
- `LEGACY_DB_PATH=./data/legacy` controls the persistent local database directory.

- [ ] Add `@electric-sql/pglite` to backend dependencies.
- [ ] Add local database environment variables with safe defaults.
- [ ] Ignore `backend/data/` so database files never enter Git.

### Task 2: Replace the local pg pool with a PGlite compatibility layer

**Files:**
- Modify: `backend/src/db.js`

**Interfaces:**
- Preserve `pool.query(sql, params)` returning `{ rows, rowCount }`.
- Preserve `pool.connect()` returning `{ query, release }` for existing transactional routes.
- Export `ready`, which resolves after the database directory is initialized and the schema has been applied.

- [ ] Create a persistent PGlite instance under `LEGACY_DB_PATH` when local mode is enabled.
- [ ] Keep a PostgreSQL `pg` pool path available when `LEGACY_DB_MODE=postgres`.
- [ ] Apply `database/schema.sql` automatically in local mode.
- [ ] Serialize local operations around transactional clients because PGlite uses a single embedded database connection.

### Task 3: Make backend startup wait for database readiness

**Files:**
- Modify: `backend/src/server.js`

**Interfaces:**
- Existing routes continue receiving the same `pool` object.
- HTTP server starts only after `ready` resolves.

- [ ] Import `ready` from `db.js`.
- [ ] Move `app.listen` behind `ready` so startup cannot race schema initialization.
- [ ] Preserve the existing health endpoint behavior.

### Task 4: Keep the schema portable

**Files:**
- Modify: `database/schema.sql`

**Interfaces:**
- Schema remains valid PostgreSQL SQL for both PGlite and normal PostgreSQL/Supabase.

- [ ] Remove the explicit `pgcrypto` extension dependency from the base schema because the schema only needs UUID generation and PGlite provides PostgreSQL-compatible UUID generation.
- [ ] Leave all application tables, indexes, constraints, JSONB fields, and timestamps intact.

### Task 5: Document local startup

**Files:**
- Modify: `README.md`

**Interfaces:**
- Local setup explains that PostgreSQL installation is optional when using embedded PGlite.

- [ ] Document `npm install` and `npm run dev` for local mode.
- [ ] Document the generated local database location.
- [ ] Document switching to PostgreSQL/Supabase with `LEGACY_DB_MODE=postgres`.

### Task 6: Verification

**Files:**
- Existing backend tests and project CI configuration.

- [ ] Run backend tests.
- [ ] Run web and Activity builds.
- [ ] Run JavaScript syntax checks.
- [ ] Start the backend locally and verify `/health` reports `ok: true` using the embedded database.
- [ ] Confirm a database restart preserves a test row before declaring the local database path complete.
