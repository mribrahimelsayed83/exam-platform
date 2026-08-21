const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
  statement_timeout: 30000,
});

// A pg Pool with no 'error' listener will crash the entire Node process the
// moment an idle client errors out (e.g. Postgres restarts, a network blip
// drops the connection) — this is a well-known pg footgun. The pool already
// discards the bad client and reconnects on the next query on its own, so
// this only needs to stop the crash and let us know it happened.
pool.on('error', (err) => {
  console.error('❌ Unexpected idle Postgres client error:', err.message);
  require('../utils/alertAdmin').alertAdmin('خطأ غير متوقع في اتصال قاعدة البيانات', err.stack || err.message);
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL');
    release();
  }
});

module.exports = pool;
