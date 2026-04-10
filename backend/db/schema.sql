-- =====================================================
-- EXAM PLATFORM — Database Schema (v4)
-- Run: psql -U postgres -d exam_platform -f schema.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS teachers (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password      TEXT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  subject       VARCHAR(100) DEFAULT '',
  platform_name VARCHAR(100) DEFAULT 'منصة الامتحانات',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assistants (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50) UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id               SERIAL PRIMARY KEY,
  username         VARCHAR(50) UNIQUE NOT NULL,
  password         TEXT NOT NULL,
  first_name       VARCHAR(100) NOT NULL DEFAULT '',
  last_name        VARCHAR(100) NOT NULL DEFAULT '',
  name             VARCHAR(200) NOT NULL,
  email            VARCHAR(200) UNIQUE,
  grade            SMALLINT NOT NULL CHECK (grade IN (4,5,6,7,8,9,10,11,12)),
  phone            VARCHAR(20) NOT NULL DEFAULT '',
  parent_phone     VARCHAR(20) NOT NULL DEFAULT '',
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by      INTEGER REFERENCES teachers(id),
  approved_by_asst INTEGER REFERENCES assistants(id),
  approved_at      TIMESTAMPTZ,
  reset_token      VARCHAR(200) DEFAULT NULL,
  reset_token_exp  TIMESTAMPTZ DEFAULT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exams (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  description  TEXT DEFAULT '',
  grade        SMALLINT NOT NULL CHECK (grade IN (4,5,6,7,8,9,10,11,12)),
  duration     INTEGER NOT NULL DEFAULT 30,
  pass_score   INTEGER NOT NULL DEFAULT 50,
  is_active    BOOLEAN DEFAULT TRUE,
  starts_at    TIMESTAMPTZ DEFAULT NULL,
  ends_at      TIMESTAMPTZ DEFAULT NULL,
  exam_comment TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id         SERIAL PRIMARY KEY,
  exam_id    INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  type       VARCHAR(10) NOT NULL DEFAULT 'mcq'
             CHECK (type IN ('mcq', 'truefalse', 'essay')),
  options    JSONB DEFAULT NULL,
  correct    SMALLINT DEFAULT NULL,
  max_score  INTEGER DEFAULT NULL,
  position   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS submissions (
  id              SERIAL PRIMARY KEY,
  exam_id         INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mcq_score       INTEGER NOT NULL DEFAULT 0,
  mcq_correct     INTEGER NOT NULL DEFAULT 0,
  mcq_total       INTEGER NOT NULL DEFAULT 0,
  essay_total     INTEGER NOT NULL DEFAULT 0,
  essay_graded    INTEGER NOT NULL DEFAULT 0,
  essay_score     INTEGER DEFAULT NULL,
  essay_max       INTEGER NOT NULL DEFAULT 0,
  final_score     INTEGER DEFAULT NULL,
  grading_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (grading_status IN ('auto_graded','partial','fully_graded')),
  answers         JSONB NOT NULL,
  review          JSONB NOT NULL,
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_students_status     ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_grade      ON students(grade);
CREATE INDEX IF NOT EXISTS idx_exams_grade         ON exams(grade);
CREATE INDEX IF NOT EXISTS idx_submissions_exam    ON submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);

-- ── Playlists ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playlists (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT DEFAULT '',
  thumbnail   VARCHAR(500) DEFAULT '',  -- URL صورة الغلاف
  grade       SMALLINT NOT NULL CHECK (grade IN (4,5,6,7,8,9,10,11,12)),
  position    INTEGER DEFAULT 0,        -- ترتيب القائمة
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Videos ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS videos (
  id           SERIAL PRIMARY KEY,
  playlist_id  INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  youtube_url  VARCHAR(500) NOT NULL,   -- رابط YouTube
  description  TEXT DEFAULT '',
  position     INTEGER DEFAULT 0,       -- ترتيب داخل القائمة
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlists_grade ON playlists(grade);
CREATE INDEX IF NOT EXISTS idx_videos_playlist ON videos(playlist_id);

-- ── Notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(200) NOT NULL,
  body       TEXT NOT NULL,
  grade      SMALLINT DEFAULT NULL,  -- NULL = للكل، رقم = لصف معين
  created_by INTEGER REFERENCES teachers(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (notification_id, student_id)
);

-- ── Video Likes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_likes (
  video_id   INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (video_id, student_id)
);

-- ── Video Comments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_comments (
  id         SERIAL PRIMARY KEY,
  video_id   INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_grade   ON notifications(grade);
CREATE INDEX IF NOT EXISTS idx_video_comments_video  ON video_comments(video_id);

-- ── Teacher Notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_notifications (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(50) NOT NULL,
  -- register | login | submission | comment | like
  title      VARCHAR(200) NOT NULL,
  body       TEXT NOT NULL,
  link_type  VARCHAR(50) DEFAULT NULL,
  -- 'student' | 'submission' | 'video'
  link_id    INTEGER DEFAULT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_notif_read ON teacher_notifications(is_read);

-- ── Password Reset Tokens ─────────────────────────────────────────────────
-- Already stored in students table (reset_token, reset_token_exp)
-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_students_email       ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_reset_token ON students(reset_token);

-- ── Landing Page Settings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS landing_settings (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  -- Hero section
  hero_name        VARCHAR(200) DEFAULT 'اسم المدرس',
  hero_title       VARCHAR(200) DEFAULT 'مدرس المادة',
  hero_desc        TEXT DEFAULT 'أهلاً بك في منصتنا التعليمية',
  hero_image       VARCHAR(500) DEFAULT '',
  hero_bg_color    VARCHAR(20)  DEFAULT '#2563eb',
  -- Stats
  stat1_num        VARCHAR(50)  DEFAULT '1000+',
  stat1_label      VARCHAR(100) DEFAULT 'طالب',
  stat2_num        VARCHAR(50)  DEFAULT '500+',
  stat2_label      VARCHAR(100) DEFAULT 'امتحان',
  stat3_num        VARCHAR(50)  DEFAULT '95%',
  stat3_label      VARCHAR(100) DEFAULT 'نسبة النجاح',
  stat4_num        VARCHAR(50)  DEFAULT '5+',
  stat4_label      VARCHAR(100) DEFAULT 'سنوات خبرة',
  -- Features (JSON array)
  features         JSONB DEFAULT '[
    {"icon":"🎬","title":"فيديوهات تعليمية","desc":"شرح مبسط وواضح لكل المواضيع"},
    {"icon":"📝","title":"امتحانات تفاعلية","desc":"اختبر نفسك وتابع تقدمك"},
    {"icon":"📊","title":"متابعة مستمرة","desc":"نتابع أداءك ونساعدك على التحسن"}
  ]',
  -- Testimonials (JSON array)
  testimonials     JSONB DEFAULT '[
    {"name":"طالب","text":"منصة رائعة ساعدتني كتير","grade":"أول ثانوي"},
    {"name":"طالبة","text":"شرح واضح ومبسط","grade":"ثاني ثانوي"}
  ]',
  -- CTA
  cta_title        VARCHAR(200) DEFAULT 'انضم لآلاف الطلاب',
  cta_desc         VARCHAR(500) DEFAULT 'سجّل الآن وابدأ رحلتك التعليمية',
  -- Contact
  whatsapp         VARCHAR(50)  DEFAULT '',
  telegram         VARCHAR(200) DEFAULT '',
  facebook         VARCHAR(200) DEFAULT '',
  youtube          VARCHAR(200) DEFAULT '',
  -- Meta
  platform_tagline VARCHAR(200) DEFAULT 'منصة تعليمية متكاملة',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row
INSERT INTO landing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
