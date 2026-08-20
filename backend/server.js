require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const compression = require('compression');
const pool        = require('./db/pool');
const { generateUniqueActivationCode } = require('./utils/activationCode');

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
    // Only seed positions once — skip if any exam already has a non-zero position
    const posCheck = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM exams WHERE position > 0`
    );
    if (posCheck.rows[0].cnt === 0) {
      await pool.query(`
        UPDATE exams e SET position = sub.rn
        FROM (
          SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1) AS rn
          FROM exams
        ) sub
        WHERE e.id = sub.id AND e.position = 0;
      `);
    }
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
    // Prerequisite: student must complete all previous exams first
    await pool.query(`
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS require_previous_exams BOOLEAN DEFAULT FALSE;
    `);
    // Allow base64 images in hero_image (was VARCHAR(500))
    await pool.query(`
      ALTER TABLE landing_settings ALTER COLUMN hero_image TYPE TEXT;
    `);
    // Gallery: array of base64 images stored as JSON
    await pool.query(`
      ALTER TABLE landing_settings ADD COLUMN IF NOT EXISTS gallery TEXT DEFAULT '[]';
    `);
    // Gallery auto-play interval in seconds
    await pool.query(`
      ALTER TABLE landing_settings ADD COLUMN IF NOT EXISTS gallery_interval INTEGER DEFAULT 2;
    `);
    // Sections ordering & visibility config for landing page
    await pool.query(`
      ALTER TABLE landing_settings ADD COLUMN IF NOT EXISTS sections_config TEXT DEFAULT '[]';
    `);
    // Which top-level playlists appear in the Courses section on landing
    await pool.query(`
      ALTER TABLE playlists ADD COLUMN IF NOT EXISTS show_on_landing BOOLEAN DEFAULT FALSE;
    `);
    // og:image for social sharing — stored as base64 TEXT
    await pool.query(`
      ALTER TABLE landing_settings ADD COLUMN IF NOT EXISTS og_image TEXT DEFAULT '';
    `);
    // Restrict grades to 9-11 only — platform now covers 3rd-prep + 1st/2nd
    // secondary; grade 12 was dropped (never had exams/payments, only unapproved
    // registrations) and the grade-6 legacy account was removed by the teacher.
    // Isolated in its own try/catch: existing out-of-range rows would make the
    // ADD CONSTRAINT fail, and that must not abort every migration statement
    // that follows it in this shared function.
    try {
      await pool.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_grade_check;`);
      await pool.query(`ALTER TABLE students ADD CONSTRAINT students_grade_check CHECK (grade IN (9,10,11));`);
      await pool.query(`ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_grade_check;`);
      await pool.query(`ALTER TABLE exams ADD CONSTRAINT exams_grade_check CHECK (grade IN (9,10,11));`);
      await pool.query(`ALTER TABLE playlists DROP CONSTRAINT IF EXISTS playlists_grade_check;`);
      await pool.query(`ALTER TABLE playlists ADD CONSTRAINT playlists_grade_check CHECK (grade IN (9,10,11));`);
    } catch (err) {
      console.error('⚠️  Grade-check constraint migration skipped:', err.message);
    }

    // Performance indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_exams_grade_active ON exams(grade, is_active)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_exams_position ON exams(grade, position)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_student_exam ON submissions(student_id, exam_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_exam_score ON submissions(exam_id, final_score)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_student_unread ON chat_messages(student_id, from_role, is_read)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_playlists_parent_grade ON playlists(parent_id, grade)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_exam_status ON payments(exam_id, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_grade ON notifications(grade)`);

    // ── Course (playlist) payments — extend payments to also cover top-level playlists ──
    await pool.query(`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;`);
    await pool.query(`ALTER TABLE payments ALTER COLUMN exam_id DROP NOT NULL;`);
    await pool.query(`
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE;
    `);
    await pool.query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_item_check;`);
    await pool.query(`
      ALTER TABLE payments ADD CONSTRAINT payments_item_check
        CHECK ( (exam_id IS NOT NULL AND playlist_id IS NULL)
             OR (exam_id IS NULL AND playlist_id IS NOT NULL) );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_student_playlist
        ON payments (student_id, playlist_id) WHERE playlist_id IS NOT NULL;
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_playlist ON payments(playlist_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_playlist_status ON payments(playlist_id, status);`);

    // Track when a student last logged in
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL;`);

    // Per-assistant permissions (which dashboard sections they can access).
    // Default is NULL, not '[]' — the backfill below only ever touches rows
    // that were never configured, so a teacher who deliberately empties an
    // assistant's permissions never gets overwritten back to "all" on the
    // next server restart.
    await pool.query(`ALTER TABLE assistants ADD COLUMN IF NOT EXISTS permissions TEXT DEFAULT NULL;`);
    await pool.query(`
      UPDATE assistants SET permissions =
        '["exams","submissions","students","videos","chat","notifications","payments"]'
      WHERE permissions IS NULL;
    `);

    // Student profile — governorate/city, and a permanent short lookup code
    // the teacher can use to manually activate a paid exam/course for a
    // student (e.g. after an off-platform cash/Vodafone-Cash payment).
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS governorate TEXT DEFAULT '';`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';`);
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS activation_code TEXT;`);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_students_activation_code
        ON students(activation_code) WHERE activation_code IS NOT NULL;
    `);
    // Backfill codes only for rows that don't have one yet (new registrations
    // generate their own code at insert time — see routes/auth.js).
    try {
      const { rows: needCode } = await pool.query('SELECT id FROM students WHERE activation_code IS NULL');
      for (const s of needCode) {
        const code = await generateUniqueActivationCode(pool);
        await pool.query('UPDATE students SET activation_code=$1 WHERE id=$2', [code, s.id]);
      }
    } catch (err) {
      console.error('⚠️  Activation-code backfill skipped:', err.message);
    }

    // Web Push subscriptions — one row per browser/device a user enabled notifications on.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         SERIAL PRIMARY KEY,
        user_role  TEXT NOT NULL CHECK (user_role IN ('student','teacher','assistant')),
        user_id    INTEGER NOT NULL,
        endpoint   TEXT NOT NULL UNIQUE,
        p256dh     TEXT NOT NULL,
        auth       TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_role, user_id);`);

    // Exam units — folders that group standalone exams within a grade,
    // mirroring the playlist/sub-playlist pattern already used for videos.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exam_lists (
        id          SERIAL PRIMARY KEY,
        grade       SMALLINT NOT NULL CHECK (grade IN (9,10,11)),
        title       VARCHAR(200) NOT NULL,
        description TEXT DEFAULT '',
        position    INTEGER DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS list_id INTEGER
        REFERENCES exam_lists(id) ON DELETE SET NULL;
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_exam_lists_grade ON exam_lists(grade);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_exams_list ON exams(list_id);`);

    // Lessons inside units — exam_lists can nest one level via parent_id,
    // mirroring the playlist/sub-playlist pattern used for videos.
    await pool.query(`
      ALTER TABLE exam_lists ADD COLUMN IF NOT EXISTS parent_id INTEGER
        REFERENCES exam_lists(id) ON DELETE CASCADE;
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_exam_lists_parent ON exam_lists(parent_id);`);

    console.log('✅ Migrations applied');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
}

runMigrations();

const app = express();

// Railway sits in front of this app behind one reverse-proxy hop — without
// this, req.ip is always the proxy's own address, so every user shares one
// bucket in the rate limiters below (one busy user can lock out everyone
// else, and legitimate combined traffic trips the login limiter for no
// individual reason).
app.set('trust proxy', 1);

app.use(compression());

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'محاولات كثيرة جداً — انتظر 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'محاولات كثيرة جداً — انتظر ساعة' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'محاولات تسجيل كثيرة جداً — انتظر ساعة' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip),
  message: { message: 'طلبات كثيرة جداً — انتظر دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ FATAL: JWT_SECRET يجب أن يكون 32 حرف على الأقل');
  process.exit(1);
}

app.use('/api/auth/student/login',   loginLimiter);
app.use('/api/auth/teacher/login',   loginLimiter);
app.use('/api/auth/assistant/login', loginLimiter);
app.use('/api/auth/forgot-password', forgotLimiter);
app.use('/api/auth/register',        registerLimiter);
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
app.use('/api/push',          require('./routes/push'));
app.use('/api/search',        searchLimiter, require('./routes/search'));

app.get('/api/health', (_,res) => res.json({ status:'ok' }));
app.use((req,res) => res.status(404).json({ message:'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));

require('./utils/dbBackup').scheduleDailyBackup();
