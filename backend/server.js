require('dotenv').config();

const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, sendDefaultPii: false });
}

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const compression = require('compression');
const pool        = require('./db/pool');
const { generateUniqueActivationCode } = require('./utils/activationCode');
const { alertAdmin } = require('./utils/alertAdmin');

// Last line of defense — a bug that throws outside any try/catch (or an
// unhandled promise rejection) would otherwise crash the process silently.
// Alert before exiting; Railway restarts the container automatically, so
// the goal here is just "know it happened," not prevent the exit.
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception — process will exit:', err);
  alertAdmin('السيرفر وقع بسبب خطأ غير متوقع (uncaughtException)', err.stack || err.message)
    .finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  const detail = reason instanceof Error ? (reason.stack || reason.message) : String(reason);
  console.error('❌ Unhandled promise rejection:', detail);
  alertAdmin('السيرفر وقع بسبب خطأ غير متوقع (unhandledRejection)', detail)
    .finally(() => process.exit(1));
});

// ── Auto-migration: run on every startup (safe — uses IF NOT EXISTS) ──────
// Each entry runs in its own try/catch (see runMigrations below) — a failure
// in one step logs a warning and moves on instead of silently blocking every
// step after it. That's not hypothetical: a legacy out-of-range grade value
// once made the grade-check-constraint step fail, which — back when this was
// one giant shared try/catch — silently aborted every migration written
// after it in the file, including ones already deployed weeks earlier.
const MIGRATION_STEPS = [
  {
    name: 'playlists: sub-playlists (parent_id) + playlist_items table',
    run: async () => {
      await pool.query(`
        ALTER TABLE playlists
          ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL
          REFERENCES playlists(id) ON DELETE CASCADE;
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_playlists_parent ON playlists(parent_id);`);
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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);`);
    },
  },
  {
    name: 'playlists/playlist_items: base64 image/file columns + type constraint',
    run: async () => {
      // Make thumbnail column TEXT to support base64 image uploads
      await pool.query(`ALTER TABLE playlists ALTER COLUMN thumbnail TYPE TEXT;`);
      // Add file upload columns to playlist_items
      await pool.query(`ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS file_name VARCHAR(200) DEFAULT '';`);
      await pool.query(`ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS file_data TEXT DEFAULT '';`);
      // Remove 'assignment' from allowed types (safe — no existing data)
      await pool.query(`ALTER TABLE playlist_items DROP CONSTRAINT IF EXISTS playlist_items_type_check;`);
      await pool.query(`
        ALTER TABLE playlist_items ADD CONSTRAINT playlist_items_type_check
          CHECK (type IN ('video','exam','file'));
      `);
    },
  },
  {
    name: 'exams: position column + one-time position seed',
    run: async () => {
      await pool.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;`);
      // Only seed positions once — skip if any exam already has a non-zero position
      const posCheck = await pool.query(`SELECT COUNT(*)::int AS cnt FROM exams WHERE position > 0`);
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
    },
  },
  {
    name: 'video_views table (tracks which videos/items students open)',
    run: async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS video_views (
          id         SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          item_id    INTEGER REFERENCES playlist_items(id) ON DELETE SET NULL,
          title      VARCHAR(300) NOT NULL DEFAULT '',
          viewed_at  TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_video_views_student ON video_views(student_id);`);
    },
  },
  {
    name: 'notifications: per-student targeting + notification_reads unique index',
    run: async () => {
      await pool.query(`
        ALTER TABLE notifications
          ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE CASCADE;
      `);
      // Ensure unique constraint on notification_reads so ON CONFLICT DO NOTHING works
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_reads
          ON notification_reads (notification_id, student_id);
      `);
    },
  },
  {
    name: 'teachers/exams: WhatsApp parent-notification settings',
    run: async () => {
      await pool.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS send_whatsapp BOOLEAN DEFAULT FALSE;`);
      await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS whatsapp_instance VARCHAR(100) DEFAULT '';`);
      await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS whatsapp_token VARCHAR(200) DEFAULT '';`);
    },
  },
  {
    name: 'exams: price + payments table',
    run: async () => {
      await pool.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS price INTEGER DEFAULT 0;`);
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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_exam ON payments(exam_id);`);
    },
  },
  {
    name: 'exams: shuffle_questions/shuffle_options',
    run: async () => {
      await pool.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE;`);
      await pool.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT FALSE;`);
    },
  },
  {
    name: 'personal_exam_submissions table (per-student practice from wrong answers)',
    run: async () => {
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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_personal_exam_student ON personal_exam_submissions(student_id);`);
    },
  },
  {
    name: 'chat_messages table (student <-> teacher/assistants)',
    run: async () => {
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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_student ON chat_messages(student_id);`);
    },
  },
  {
    name: 'staff_messages table (teacher <-> assistants)',
    run: async () => {
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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_staff_msg_participants ON staff_messages(from_id, to_id);`);
    },
  },
  {
    name: 'exams: require_previous_exams prerequisite flag',
    run: async () => {
      await pool.query(`ALTER TABLE exams ADD COLUMN IF NOT EXISTS require_previous_exams BOOLEAN DEFAULT FALSE;`);
    },
  },
  {
    name: 'landing_settings: base64 hero/gallery/og images + sections config',
    run: async () => {
      // Allow base64 images in hero_image (was VARCHAR(500))
      await pool.query(`ALTER TABLE landing_settings ALTER COLUMN hero_image TYPE TEXT;`);
      // Gallery: array of base64 images stored as JSON
      await pool.query(`ALTER TABLE landing_settings ADD COLUMN IF NOT EXISTS gallery TEXT DEFAULT '[]';`);
      // Gallery auto-play interval in seconds
      await pool.query(`ALTER TABLE landing_settings ADD COLUMN IF NOT EXISTS gallery_interval INTEGER DEFAULT 2;`);
      // Sections ordering & visibility config for landing page
      await pool.query(`ALTER TABLE landing_settings ADD COLUMN IF NOT EXISTS sections_config TEXT DEFAULT '[]';`);
      // Which top-level playlists appear in the Courses section on landing
      await pool.query(`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS show_on_landing BOOLEAN DEFAULT FALSE;`);
      // og:image for social sharing — stored as base64 TEXT
      await pool.query(`ALTER TABLE landing_settings ADD COLUMN IF NOT EXISTS og_image TEXT DEFAULT '';`);
    },
  },
  {
    // Restrict grades to 9-11 only — platform now covers 3rd-prep + 1st/2nd
    // secondary; grade 12 was dropped (never had exams/payments, only
    // unapproved registrations) and the grade-6 legacy account was removed
    // by the teacher. This is the step that used to be able to take the
    // whole shared try/catch down with it if a stray out-of-range row ever
    // reappeared — now it's just one more isolated step like the rest.
    name: 'students/exams/playlists: restrict grade CHECK to 9-11',
    run: async () => {
      await pool.query(`ALTER TABLE students DROP CONSTRAINT IF EXISTS students_grade_check;`);
      await pool.query(`ALTER TABLE students ADD CONSTRAINT students_grade_check CHECK (grade IN (9,10,11));`);
      await pool.query(`ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_grade_check;`);
      await pool.query(`ALTER TABLE exams ADD CONSTRAINT exams_grade_check CHECK (grade IN (9,10,11));`);
      await pool.query(`ALTER TABLE playlists DROP CONSTRAINT IF EXISTS playlists_grade_check;`);
      await pool.query(`ALTER TABLE playlists ADD CONSTRAINT playlists_grade_check CHECK (grade IN (9,10,11));`);
    },
  },
  {
    name: 'performance indexes — batch 1',
    run: async () => {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_exams_grade_active ON exams(grade, is_active)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_exams_position ON exams(grade, position)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_student_exam ON submissions(student_id, exam_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_submissions_exam_score ON submissions(exam_id, final_score)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_student_unread ON chat_messages(student_id, from_role, is_read)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_playlists_parent_grade ON playlists(parent_id, grade)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_exam_status ON payments(exam_id, status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_grade ON notifications(grade)`);
    },
  },
  {
    name: 'payments: extend to cover top-level playlist (course) purchases',
    run: async () => {
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
    },
  },
  {
    name: 'students: last_login_at',
    run: async () => {
      await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL;`);
    },
  },
  {
    name: 'assistants: per-assistant dashboard permissions',
    run: async () => {
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
    },
  },
  {
    name: 'students: governorate/city + activation_code (unique index only)',
    run: async () => {
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
    },
  },
  {
    name: 'students: backfill activation_code for rows without one',
    run: async () => {
      // New registrations generate their own code at insert time — see
      // routes/auth.js — this only ever touches pre-existing rows.
      const { rows: needCode } = await pool.query('SELECT id FROM students WHERE activation_code IS NULL');
      for (const s of needCode) {
        const code = await generateUniqueActivationCode(pool);
        await pool.query('UPDATE students SET activation_code=$1 WHERE id=$2', [code, s.id]);
      }
    },
  },
  {
    name: 'push_subscriptions table (Web Push)',
    run: async () => {
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
    },
  },
  {
    name: 'exam_lists table (units — folders grouping exams within a grade)',
    run: async () => {
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
    },
  },
  {
    name: 'exam_lists: lessons nesting (parent_id, one level deep)',
    run: async () => {
      await pool.query(`
        ALTER TABLE exam_lists ADD COLUMN IF NOT EXISTS parent_id INTEGER
          REFERENCES exam_lists(id) ON DELETE CASCADE;
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_exam_lists_parent ON exam_lists(parent_id);`);
    },
  },
  {
    name: 'teachers: two-factor auth (TOTP) columns',
    run: async () => {
      await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS two_factor_secret TEXT DEFAULT NULL;`);
      await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;`);
    },
  },
  {
    name: 'automatic reminders: dedupe table + inactivity-reminder column',
    run: async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS exam_deadline_reminders (
          exam_id    INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          sent_at    TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (exam_id, student_id)
        );
      `);
      await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS last_inactivity_reminder_at TIMESTAMPTZ DEFAULT NULL;`);
    },
  },
  {
    name: 'index review — questions/video_views/notifications',
    run: async () => {
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_questions_exam ON questions(exam_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_video_views_item ON video_views(item_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_student ON notifications(student_id);`);
    },
  },
  {
    // Articles / study-tips section — hidden from students until the teacher
    // switches it on from Settings (articles_enabled), same pattern as every
    // other opt-in toggle on the teachers row.
    name: 'articles: study-tips section (table + teacher-controlled toggle)',
    run: async () => {
      await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS articles_enabled BOOLEAN NOT NULL DEFAULT FALSE;`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS articles (
          id           SERIAL PRIMARY KEY,
          title        VARCHAR(300) NOT NULL,
          summary      TEXT DEFAULT '',
          content      TEXT NOT NULL DEFAULT '',
          cover_image  TEXT DEFAULT '',
          position     INTEGER DEFAULT 0,
          is_published BOOLEAN NOT NULL DEFAULT TRUE,
          created_at   TIMESTAMPTZ DEFAULT NOW(),
          updated_at   TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_articles_published_position ON articles(is_published, position);`);
    },
  },
  {
    // Online status — separate from last_login_at (which only updates once,
    // at the login *event*). last_seen_at is refreshed by a periodic
    // heartbeat while the student has the app open, so the teacher can tell
    // who's online right now (recently-refreshed) vs. just when they last
    // logged in.
    name: 'students: last_seen_at (online-status heartbeat)',
    run: async () => {
      await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;`);
    },
  },
  {
    // Single active device per student — see routes/auth.js student login
    // and middleware/auth.js for how this gets enforced.
    name: 'students: current_session_token (single-device login)',
    run: async () => {
      await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS current_session_token TEXT DEFAULT NULL;`);
    },
  },
  {
    // chat_messages never recorded WHICH specific teacher/assistant sent a
    // message (only from_role + from_name) — so the edit/delete routes in
    // routes/chat.js, which filter on from_id, were querying a column that
    // never existed and always 500ing. Existing rows get NULL (unknown
    // sender id, so effectively un-editable) — no way to recover that
    // retroactively, only new messages get a real one.
    name: 'chat_messages: from_id (fixes edit/delete, which relied on it already)',
    run: async () => {
      await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS from_id INTEGER DEFAULT NULL;`);
    },
  },
];

async function runMigrations() {
  let failures = 0;
  for (const step of MIGRATION_STEPS) {
    try {
      await step.run();
    } catch (err) {
      failures++;
      console.error(`⚠️  Migration step "${step.name}" failed (continuing with the rest):`, err.message);
    }
  }
  if (failures > 0) {
    console.error(`❌ ${failures} migration step(s) failed — see warnings above`);
    alertAdmin(`${failures} خطوة/خطوات من ترحيل قاعدة البيانات فشلت عند تشغيل السيرفر`, 'راجع سجلات Railway لمعرفة التفاصيل').catch(() => {});
  } else {
    console.log('✅ Migrations applied');
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
app.use('/api/articles',      require('./routes/articles'));

app.get('/api/health', (_,res) => res.json({ status:'ok' }));

// Catches errors passed to next(err) — most routes here catch and respond
// locally instead, so this mainly protects future code that doesn't.
if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

app.use((req,res) => res.status(404).json({ message:'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));

require('./utils/dbBackup').scheduleDailyBackup();
require('./utils/reminders').scheduleDailyReminders();
