const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { notifyStudent } = require('../utils/studentNotif');

const staff = auth.staff;

// ── GET /teacher/students/:id ─────────────────────────────────────────────
router.get('/students/:id', staff, async (req, res) => {
  try {
    const studentRes = await pool.query(
      `SELECT st.id, st.name, st.username, st.grade, st.phone, st.parent_phone,
              st.email, st.status, st.created_at,
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

    res.json({
      student: studentRes.rows[0],
      submissions: subsRes.rows,
      video_views: viewsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /teacher/students ─────────────────────────────────────────────────
router.get('/students', staff, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT st.id, st.name, st.username, st.grade, st.phone, st.parent_phone,
             st.status, st.created_at, st.approved_at,
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
router.put('/students/:id/approve', staff, async (req, res) => {
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
router.put('/students/:id/reject', staff, async (req, res) => {
  try {
    await pool.query(`UPDATE students SET status='rejected' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'تم رفض الطالب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Edit ──────────────────────────────────────────────────────────────────
router.put('/students/:id', staff, async (req, res) => {
  const { name, grade, phone, parent_phone, email, username, newPassword } = req.body;
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

    if (newPassword) {
      if (newPassword.length < 6) return res.status(400).json({ message: 'كلمة المرور 6 أحرف على الأقل' });
      const hashed = await bcrypt.hash(newPassword, 10);
      await pool.query(
        `UPDATE students SET name=$1, grade=$2, phone=$3, parent_phone=$4,
          email=COALESCE(NULLIF($5,''), email),
          username=COALESCE(NULLIF($6,''), username),
          password=$7
         WHERE id=$8`,
        [name, grade, phone, parent_phone, email||'', username||'', hashed, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE students SET name=$1, grade=$2, phone=$3, parent_phone=$4,
          email=COALESCE(NULLIF($5,''), email),
          username=COALESCE(NULLIF($6,''), username)
         WHERE id=$7`,
        [name, grade, phone, parent_phone, email||'', username||'', req.params.id]
      );
    }
    res.json({ message: 'تم تعديل بيانات الطالب' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Delete ────────────────────────────────────────────────────────────────
router.delete('/students/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM students WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف الطالب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Assistants ────────────────────────────────────────────────────────────
router.get('/assistants', staff, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, username, created_at FROM assistants ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.post('/assistants', staff, async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password)
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  if (password.length < 6)
    return res.status(400).json({ message: 'كلمة المرور 6 حروف على الأقل' });
  try {
    const exists = await pool.query('SELECT id FROM assistants WHERE username=$1', [username]);
    if (exists.rows.length) return res.status(409).json({ message: 'اسم المستخدم مستخدم' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO assistants (name, username, password) VALUES ($1,$2,$3)',
      [name, username, hashed]
    );
    res.status(201).json({ message: 'تم إضافة المساعد' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.delete('/assistants/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM assistants WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف المساعد' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
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
      [name, subject||'', platformName||'منصة الامتحانات', req.user.id]
    );
    res.json({ message: 'تم حفظ الإعدادات' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;

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

// DELETE /teacher/my-notifications/:id
router.delete('/my-notifications/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM teacher_notifications WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});
