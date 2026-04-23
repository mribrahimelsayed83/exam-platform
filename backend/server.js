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
    // Make thumbnail column TEXT to support base64 image uploads
    await pool.query(`
      ALTER TABLE playlists ALTER COLUMN thumbnail TYPE TEXT;
    `);
    // Add file upload columns to playlist_items
    await pool.query(`
      ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS file_name VARCHAR(200) DEFAULT '';
    `);
    await pool.query(`
      ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS file_data TEXT DEFAULT '';
    `);
    // Remove 'assignment' from allowed types (safe — no existing data)
    await pool.query(`
      ALTER TABLE playlist_items DROP CONSTRAINT IF EXISTS playlist_items_type_check;
    `);
    await pool.query(`
      ALTER TABLE playlist_items ADD CONSTRAINT playlist_items_type_check
        CHECK (type IN ('video','exam','file'));
    `);
    // Add position column to exams for teacher-controlled ordering
    await pool.query(`
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
    `);
    await pool.query(`
      UPDATE exams e SET position = sub.rn
      FROM (
        SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1) AS rn
        FROM exams
      ) sub
      WHERE e.id = sub.id AND e.position = 0;
    `);
    // Track which videos/items students open
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_views (
        id         SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        item_id    INTEGER REFERENCES playlist_items(id) ON DELETE SET NULL,
        title      VARCHAR(300) NOT NULL DEFAULT '',
        viewed_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_video_views_student ON video_views(student_id);
    `);
    // Add student_id to notifications for targeted (per-student) notifications
    await pool.query(`
      ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE CASCADE;
    `);
    // Ensure unique constraint on notification_reads so ON CONFLICT DO NOTHING works
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_reads
        ON notification_reads (notification_id, student_id);
    `);
    // WhatsApp parent notification feature
    await pool.query(`
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS send_whatsapp BOOLEAN DEFAULT FALSE;
    `);
    await pool.query(`
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS whatsapp_instance VARCHAR(100) DEFAULT '';
    `);
    await pool.query(`
      ALTER TABLE teachers ADD COLUMN IF NOT EXISTS whatsapp_token VARCHAR(200) DEFAULT '';
    `);
    // Exam price (0 = free)
    await pool.query(`
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;
    `);
    // Payments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                     SERIAL PRIMARY KEY,
        student_id             INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        exam_id                INTEGER NOT NULL REFERENCES exams(id)    ON DELETE CASCADE,
        amount                 INTEGER NOT NULL,
        paymob_order_id        VARCHAR(100),
        paymob_transaction_id  VARCHAR(100),
        status                 VARCHAR(20) DEFAULT 'pending',
        paid_at                TIMESTAMPTZ,
        created_at             TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (student_id, exam_id)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_exam ON payments(exam_id);
    `);
    // Shuffle settings per exam
    await pool.query(`
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE;
    `);
    await pool.query(`
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT FALSE;
    `);
    // Personal exam submissions (per-student practice from wrong answers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS personal_exam_submissions (
        id            SERIAL PRIMARY KEY,
        student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        answers       JSONB DEFAULT '{}',
        review        JSONB DEFAULT '[]',
        score         INTEGER DEFAULT 0,
        total         INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        submitted_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_personal_exam_student
        ON personal_exam_submissions(student_id);
    `);
    // Chat messages between students and teacher/assistants
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id          SERIAL PRIMARY KEY,
        student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        from_role   VARCHAR(20) NOT NULL,
        from_name   VARCHAR(200) NOT NULL DEFAULT '',
        message     TEXT NOT NULL,
        is_read     BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_student ON chat_messages(student_id);
    `);
    // Direct messages between teacher and assistants
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_messages (
        id          SERIAL PRIMARY KEY,
        from_id     INTEGER NOT NULL,
        from_role   VARCHAR(20) NOT NULL,
        from_name   VARCHAR(200) NOT NULL DEFAULT '',
        to_id       INTEGER NOT NULL,
        to_role     VARCHAR(20) NOT NULL,
        to_name     VARCHAR(200) NOT NULL DEFAULT '',
        message     TEXT NOT NULL,
        is_read     BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_msg_participants
        ON staff_messages(from_id, to_id);
    `);
    console.log('✅ Migrations applied');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
}

runMigrations();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/exams',       require('./routes/exams'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/teacher',     require('./routes/teacher'));
app.use('/api/videos',        require('./routes/videos'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/landing',        require('./routes/landing'));
app.use('/api/personal-exam', require('./routes/personalExam'));
app.use('/api/payments',      require('./routes/payments'));
app.use('/api/chat',          require('./routes/chat'));

app.get('/api/health', (_,res) => res.json({ status:'ok' }));
app.use((req,res) => res.status(404).json({ message:'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
