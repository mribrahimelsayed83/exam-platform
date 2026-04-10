require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db/pool');

// ── Auto-migration: run on every startup (safe — uses IF NOT EXISTS) ──────
async function runMigrations() {
  try {
    await pool.query(`
      ALTER TABLE playlists
        ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL
        REFERENCES playlists(id) ON DELETE CASCADE;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlists_parent ON playlists(parent_id);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id          SERIAL PRIMARY KEY,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        type        VARCHAR(20) NOT NULL CHECK (type IN ('video','exam','assignment','file')),
        title       VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        position    INTEGER DEFAULT 0,
        youtube_url VARCHAR(500) DEFAULT '',
        exam_id     INTEGER REFERENCES exams(id) ON DELETE SET NULL,
        file_url    VARCHAR(500) DEFAULT '',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
    `);
    console.log('✅ Migrations applied');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
}

runMigrations();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/exams',       require('./routes/exams'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/teacher',     require('./routes/teacher'));
app.use('/api/videos',        require('./routes/videos'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/landing',       require('./routes/landing'));
app.use('/api/landing',       require('./routes/landing'));
app.use('/api/landing',       require('./routes/landing'));

app.get('/api/health', (_,res) => res.json({ status:'ok' }));
app.use((req,res) => res.status(404).json({ message:'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
