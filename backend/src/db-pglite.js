'use strict';

const fs = require('fs');
const path = require('path');
const { ensureIdentityGuard } = require('./identity-guard');

const root = path.resolve(__dirname, '..', '..');
const schemaPath = path.join(root, 'database', 'schema.sql');
const dataPath = path.resolve(root, process.env.LEGACY_DB_PATH || 'backend/data/legacy');

class Mutex {
  constructor() {
    this.tail = Promise.resolve();
  }

  async lock() {
    let release;
    const next = new Promise((resolve) => { release = resolve; });
    const previous = this.tail;
    this.tail = previous.then(() => next);
    await previous;
    return release;
  }
}

function resultOf(result) {
  return {
    ...result,
    rows: result.rows || [],
    rowCount: result.rowCount ?? result.affectedRows ?? (result.rows ? result.rows.length : 0)
  };
}

let db;
const mutex = new Mutex();

const ready = (async () => {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  const { PGlite } = await import('@electric-sql/pglite');
  db = await PGlite.create(dataPath);
  await db.exec(fs.readFileSync(schemaPath, 'utf8'));

  const guardPool = {
    query: async (sql, params = []) => resultOf(await db.query(sql, params))
  };
  await ensureIdentityGuard(guardPool);
})();

const pool = {
  async query(sql, params = []) {
    await ready;
    const release = await mutex.lock();
    try {
      return resultOf(await db.query(sql, params));
    } finally {
      release();
    }
  },

  async connect() {
    await ready;
    const releaseLock = await mutex.lock();
    let released = false;
    return {
      query: async (sql, params = []) => resultOf(await db.query(sql, params)),
      release() {
        if (!released) {
          released = true;
          releaseLock();
        }
      }
    };
  },

  async end() {
    await ready;
    if (db && db.close) await db.close();
  }
};

module.exports = { pool, ready };
