const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { notifyStudent } = require('../utils/studentNotif');

const staff = auth.staff;
const perm  = auth.permission('students');

// ── GET /teacher/students/:id ─────────────────────────────────────────────
router.get('/students/:id', staff, perm, async (req, res) => {
  try {
    const studentRes = await pool.query(
      `SELECT st.id, st.name, st.username, st.grade, st.phone, st.parent_phone,
              st.email, st.status, st.created_at, st.last_login_at,
              st.governorate, st.city, st.activation_code,
              t.name AS approved_by_name,
              a.name AS approved_by_asst_name
       FROM students st
       LEFT JOIN teachers   t ON t.id = st.approved_by
       LEFT JOIN assistants a ON a.id = st.approved_by_asst
       WHERE st.id = $1`,
      [req.params.id]
    );
    if (!studentRes.rows[0]) return res.status(404).json({ message: 'الطالب مش موجود' });

    const subsRes = await pool.query(
      `SELECT s.id, s.mcq_score, s.mcq_correct, s.mcq_total,
              s.essay_total, s.essay_graded, s.essay_score, s.essay_max,
              s.final_score, s.grading_status, s.submitted_at, s.review,
              e.title AS exam_title, e.pass_score, e.exam_comment, e.duration
       FROM submissions s
       JOIN exams e ON e.id = s.exam_id
       WHERE s.student_id = $1
       ORDER BY s.submitted_at DESC`,
      [req.params.id]
    );

    const viewsRes = await pool.query(
      `SELECT vv.title, vv.viewed_at, vv.item_id
       FROM video_views vv
       WHERE vv.student_id = $1
       ORDER BY vv.viewed_at DESC`,
      [req.params.id]
    );

    const paymentsRes = await pool.query(
      `SELECT p.id, p.amount, p.status, p.paid_at, p.created_at,
              COALESCE(e.title, pl.title) AS item_title,
              CASE WHEN p.exam_id IS NOT NULL THEN 'exam' ELSE 'playlist' END AS item_type
       FROM payments p
       LEFT JOIN exams e      ON e.id = p.exam_id
       LEFT JOIN playlists pl ON pl.id = p.playlist_id
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC`,
      [req.params.id]
    );

    res.json({
      student: studentRes.rows[0],
      submissions: subsRes.rows,
      video_views: viewsRes.rows,
      payments: paymentsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /teacher/students ─────────────────────────────────────────────────
router.get('/students', staff, perm, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT st.id, st.name, st.username, st.grade, st.phone, st.parent_phone,
             st.email, st.status, st.created_at, st.approved_at,
             st.governorate, st.city, st.activation_code,
             t.name AS approved_by_name,
             a.name AS approved_by_asst_name,
             COUNT(s.id)::int AS submission_count,
             ROUND(AVG(s.final_score))::int AS avg_score
      FROM students st
      LEFT JOIN teachers   t ON t.id = st.approved_by
      LEFT JOIN assistants a ON a.id = st.approved_by_asst
      LEFT JOIN submissions s ON s.student_id = st.id
    `;
    const params = [];
    if (status && status !== 'all') {
      params.push(status);
      query += ` WHERE st.status = $1`;
    }
    query += ' GROUP BY st.id, t.name, a.name ORDER BY st.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Approve ───────────────────────────────────────────────────────────────
router.put('/students/:id/approve', staff, perm, async (req, res) => {
  try {
    const { id, role } = req.user;
    const col = role === 'teacher' ? 'approved_by' : 'approved_by_asst';
    await pool.query(
      `UPDATE students SET status='approved', ${col}=$1, approved_at=NOW() WHERE id=$2`,
      [id, req.params.id]
    );
    notifyStudent(Number(req.params.id), '✅ تم قبول حسابك', 'مبروك! تم قبول حسابك في المنصة. يمكنك الآن الدخول والبدء في الدراسة.');
    res.json({ message: 'تم قبول الطالب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Reject ────────────────────────────────────────────────────────────────
router.put('/students/:id/reject', staff, perm, async (req, res) => {
  try {
    await pool.query(`UPDATE students SET status='rejected' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'تم رفض الطالب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Bulk approve / reject ────────────────────────────────────────────────
router.post('/students/bulk-approve', staff, perm, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'لا يوجد طلاب محددون' });
  try {
    const { id, role } = req.user;
    const col = role === 'teacher' ? 'approved_by' : 'approved_by_asst';
    await pool.query(
      `UPDATE students SET status='approved', ${col}=$1, approved_at=NOW() WHERE id = ANY($2::int[])`,
      [id, ids]
    );
    ids.forEach(sid => notifyStudent(Number(sid), '✅ تم قبول حسابك', 'مبروك! تم قبول حسابك في المنصة. يمكنك الآن الدخول والبدء في الدراسة.'));
    res.json({ message: `تم قبول ${ids.length} طالب` });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.post('/students/bulk-reject', staff, perm, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'لا يوجد طلاب محددون' });
  try {
    await pool.query(`UPDATE students SET status='rejected' WHERE id = ANY($1::int[])`, [ids]);
    res.json({ message: `تم رفض ${ids.length} طالب` });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Edit ──────────────────────────────────────────────────────────────────
router.put('/students/:id', staff, perm, async (req, res) => {
  const { name, grade, phone, parent_phone, email, username, governorate, city } = req.body;
  try {
    // Check username uniqueness if changed
    if (username) {
      const dup = await pool.query(
        'SELECT id FROM students WHERE username=$1 AND id!=$2',
        [username.toLowerCase(), req.params.id]
      );
      if (dup.rows.length) return res.status(409).json({ message: 'اسم المستخدم مستخدم بالفعل' });
    }
    // Check email uniqueness if changed
    if (email) {
      const dup = await pool.query(
        'SELECT id FROM students WHERE email=$1 AND id!=$2',
        [email.toLowerCase(), req.params.id]
      );
      if (dup.rows.length) return res.status(409).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    await pool.query(
      `UPDATE students SET name=$1, grade=$2, phone=$3, parent_phone=$4,
        email=COALESCE(NULLIF($5,''), email),
        username=COALESCE(NULLIF($6,''), username),
        governorate=COALESCE(NULLIF($7,''), governorate),
        city=COALESCE(NULLIF($8,''), city)
       WHERE id=$9`,
      [name, grade, phone, parent_phone, email||'', username||'', governorate||'', city||'', req.params.id]
    );
    res.json({ message: 'تم تعديل بيانات الطالب' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Reset student password ────────────────────────────────────────────────
router.post('/students/:id/reset-password', auth('teacher'), async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ message: 'كلمة المرور 6 أحرف على الأقل' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'UPDATE students SET password=$1 WHERE id=$2 RETURNING id',
      [hashed, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'الطالب غير موجود' });
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Delete ────────────────────────────────────────────────────────────────
router.delete('/students/:id', staff, perm, async (req, res) => {
  try {
    await pool.query('DELETE FROM students WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف الطالب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Assistants — teacher-exclusive: an assistant must never be able to
// manage other assistants' accounts or permissions, even via a direct API call.
const ALL_PERMISSIONS = ['exams', 'submissions', 'students', 'videos', 'chat', 'notifications', 'payments'];

router.get('/assistants', auth('teacher'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, username, created_at, permissions FROM assistants ORDER BY created_at DESC'
    );
    res.json(result.rows.map(a => ({
      ...a,
      permissions: JSON.parse(a.permissions || 'null') || ALL_PERMISSIONS,
    })));
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.post('/assistants', auth('teacher'), async (req, res) => {
  const { name, username, password, permissions } = req.body;
  if (!name || !username || !password)
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  if (password.length < 6)
    return res.status(400).json({ message: 'كلمة المرور 6 حروف على الأقل' });
  const perms = Array.isArray(permissions)
    ? permissions.filter(p => ALL_PERMISSIONS.includes(p))
    : ALL_PERMISSIONS;
  try {
    const exists = await pool.query('SELECT id FROM assistants WHERE username=$1', [username]);
    if (exists.rows.length) return res.status(409).json({ message: 'اسم المستخدم مستخدم' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO assistants (name, username, password, permissions) VALUES ($1,$2,$3,$4)',
      [name, username, hashed, JSON.stringify(perms)]
    );
    res.status(201).json({ message: 'تم إضافة المساعد' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.delete('/assistants/:id', auth('teacher'), async (req, res) => {
  try {
    await pool.query('DELETE FROM assistants WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف المساعد' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── PUT /teacher/assistants/:id/permissions ────────────────────────────────
router.put('/assistants/:id/permissions', auth('teacher'), async (req, res) => {
  const { permissions } = req.body;
  if (!Array.isArray(permissions))
    return res.status(400).json({ message: 'صلاحيات غير صحيحة' });
  const perms = permissions.filter(p => ALL_PERMISSIONS.includes(p));
  try {
    await pool.query('UPDATE assistants SET permissions=$1 WHERE id=$2', [JSON.stringify(perms), req.params.id]);
    res.json({ message: 'تم تحديث الصلاحيات' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── POST /teacher/backup-now — teacher-only, trigger an on-demand backup
// email in addition to the automatic nightly one (e.g. right before a risky
// bulk change) ───────────────────────────────────────────────────────────
router.post('/backup-now', auth('teacher'), async (req, res) => {
  try {
    const { runBackup } = require('../utils/dbBackup');
    await runBackup();
    res.json({ message: 'تم إرسال النسخة الاحتياطية على البريد الإلكتروني' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'تعذّر إنشاء النسخة الاحتياطية' });
  }
});

// ── POST /teacher/reminders-now — teacher-only, run the reminder checks
// immediately instead of waiting for the daily scheduled run ───────────────
router.post('/reminders-now', auth('teacher'), async (req, res) => {
  try {
    const { runReminders } = require('../utils/reminders');
    await runReminders();
    res.json({ message: 'تم إرسال التذكيرات' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'تعذّر إرسال التذكيرات' });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────
router.get('/stats', staff, async (req, res) => {
  try {
    const [exams, students, subs, pending] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM exams'),
      pool.query('SELECT COUNT(*)::int AS count FROM students'),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE s.final_score >= e.pass_score)::int AS passed
                  FROM submissions s JOIN exams e ON e.id=s.exam_id`),
      pool.query("SELECT COUNT(*)::int AS count FROM students WHERE status='pending'"),
    ]);
    const total  = subs.rows[0].total;
    const passed = subs.rows[0].passed;
    res.json({
      exams:       exams.rows[0].count,
      students:    students.rows[0].count,
      submissions: total,
      passRate:    total > 0 ? Math.round((passed / total) * 100) : 0,
      pending:     pending.rows[0].count,
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Analytics — teacher-only decision-support data ──────────────────────────
router.get('/analytics', auth('teacher'), async (req, res) => {
  try {
    const [weakestExams, inactiveStudents, topVideos] = await Promise.all([
      // Weakest exams by pass rate (only exams with at least one graded submission)
      pool.query(`
        SELECT e.id, e.title, e.grade,
               COUNT(s.id)::int AS submission_count,
               ROUND(100.0 * COUNT(*) FILTER (WHERE s.final_score >= e.pass_score) / COUNT(s.id))::int AS pass_rate
        FROM exams e
        JOIN submissions s ON s.exam_id = e.id AND s.final_score IS NOT NULL
        GROUP BY e.id
        ORDER BY pass_rate ASC, submission_count DESC
        LIMIT 5
      `),
      // Approved students who never logged in, or haven't in 14+ days
      pool.query(`
        SELECT id, name, username, grade, last_login_at, created_at
        FROM students
        WHERE status='approved'
          AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '14 days')
        ORDER BY last_login_at ASC NULLS FIRST
        LIMIT 15
      `),
      // Most-watched videos/items (title is denormalized onto video_views at watch time)
      pool.query(`
        SELECT item_id, title, COUNT(*)::int AS view_count,
               COUNT(DISTINCT student_id)::int AS unique_students
        FROM video_views
        WHERE item_id IS NOT NULL
        GROUP BY item_id, title
        ORDER BY view_count DESC
        LIMIT 10
      `),
    ]);
    res.json({
      weakestExams:     weakestExams.rows,
      inactiveStudents: inactiveStudents.rows,
      topVideos:        topVideos.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────
router.get('/settings', auth('teacher'), async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT name,subject,platform_name FROM teachers WHERE id=$1', [req.user.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.put('/settings', auth('teacher'), async (req, res) => {
  const { name, subject, platformName } = req.body;
  try {
    await pool.query(
      'UPDATE teachers SET name=$1, subject=$2, platform_name=$3 WHERE id=$4',
      [name, subject||'', platformName||'منصة الفاروق', req.user.id]
    );
    res.json({ message: 'تم حفظ الإعدادات' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ════════════════════════════════════════
// TWO-FACTOR AUTH (TOTP) — teacher account only
// ════════════════════════════════════════

router.get('/2fa/status', auth('teacher'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT two_factor_enabled FROM teachers WHERE id=$1', [req.user.id]);
    res.json({ enabled: !!rows[0]?.two_factor_enabled });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// Generates and stores a new secret (not yet enabled — only takes effect
// once confirmed via /2fa/verify) and returns a QR code to scan.
router.post('/2fa/setup', auth('teacher'), async (req, res) => {
  try {
    const { generateSecret, generateURI } = require('otplib');
    const QRCode = require('qrcode');
    const secret = generateSecret();
    await pool.query('UPDATE teachers SET two_factor_secret=$1, two_factor_enabled=FALSE WHERE id=$2', [secret, req.user.id]);
    const { rows: [teacher] } = await pool.query('SELECT username FROM teachers WHERE id=$1', [req.user.id]);
    const otpauth = generateURI({ issuer: 'منصة الفاروق', label: teacher.username, secret });
    const qrCode  = await QRCode.toDataURL(otpauth);
    res.json({ secret, qrCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// Confirms the code from the authenticator app and flips 2FA on.
router.post('/2fa/verify', auth('teacher'), async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: 'الكود مطلوب' });
  try {
    const { verify } = require('otplib');
    const { rows } = await pool.query('SELECT two_factor_secret FROM teachers WHERE id=$1', [req.user.id]);
    const secret = rows[0]?.two_factor_secret;
    if (!secret) return res.status(400).json({ message: 'لازم تبدأ الإعداد الأول' });
    const result = await verify({ token: String(code).trim(), secret });
    if (!result.valid) return res.status(400).json({ message: 'الكود غلط — جرّب تاني' });
    await pool.query('UPDATE teachers SET two_factor_enabled=TRUE WHERE id=$1', [req.user.id]);
    res.json({ message: 'تم تفعيل التحقق بخطوتين بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// Requires the current password to confirm — prevents disabling 2FA from a
// hijacked-but-still-logged-in session without knowing the actual password.
router.post('/2fa/disable', auth('teacher'), async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'كلمة المرور مطلوبة للتأكيد' });
  try {
    const { rows } = await pool.query('SELECT password FROM teachers WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(400).json({ message: 'كلمة المرور غلط' });
    await pool.query('UPDATE teachers SET two_factor_enabled=FALSE, two_factor_secret=NULL WHERE id=$1', [req.user.id]);
    res.json({ message: 'تم تعطيل التحقق بخطوتين' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ════════════════════════════════════════
// TEACHER NOTIFICATIONS
// ════════════════════════════════════════

// GET /teacher/my-notifications
router.get('/my-notifications', staff, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM teacher_notifications
       ORDER BY created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /teacher/my-notifications/unread-count
router.get('/my-notifications/unread-count', staff, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS count FROM teacher_notifications WHERE is_read=FALSE'
    );
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /teacher/my-notifications/read-all
router.post('/my-notifications/read-all', staff, async (req, res) => {
  try {
    await pool.query('UPDATE teacher_notifications SET is_read=TRUE');
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /teacher/my-notifications/:id/read
router.post('/my-notifications/:id/read', staff, async (req, res) => {
  try {
    await pool.query('UPDATE teacher_notifications SET is_read=TRUE WHERE id=$1', [req.params.id]);
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /teacher/my-notifications/bulk-delete
router.post('/my-notifications/bulk-delete', staff, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ message: 'لا توجد إشعارات' });
    await pool.query('DELETE FROM teacher_notifications WHERE id = ANY($1::int[])', [ids]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// DELETE /teacher/my-notifications/:id
router.delete('/my-notifications/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM teacher_notifications WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
