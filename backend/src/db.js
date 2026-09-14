'use strict';

const { ensureIdentityGuard } = require('./identity-guard');

if (String(process.env.LEGACY_DB_MODE || 'local').toLowerCase() === 'postgres') {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  const ready = ensureIdentityGuard(pool);
  module.exports = { pool, ready, dbMode: 'postgres' };
} else {
  const local = require('./db-pglite');
  module.exports = { ...local, dbMode: 'local' };
}
