const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const staff  = auth.staff;

// ── Staff: إرسال إشعار ────────────────────────────────────────────────────
router.post('/', staff, async (req, res) => {
  const { title, body, grade } = req.body;
  if (!title || !body)
    return res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
  try {
    const result = await pool.query(
      `INSERT INTO notifications (title, body, grade, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, body, grade || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Staff: قائمة الإشعارات المُرسَلة ─────────────────────────────────────
router.get('/sent', staff, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*, t.name AS sender_name,
              COUNT(nr.student_id)::int AS read_count
       FROM notifications n
       LEFT JOIN teachers t ON t.id = n.created_by
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id
       GROUP BY n.id, t.name
       ORDER BY n.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Staff: حذف إشعار ─────────────────────────────────────────────────────
router.delete('/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Student: جلب إشعاراته ─────────────────────────────────────────────────
router.get('/', auth('student'), async (req, res) => {
  try {
    const { id, grade } = req.user;
    const result = await pool.query(
      `SELECT n.*,
              CASE WHEN nr.student_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_read
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.student_id = $2
       WHERE n.grade IS NULL OR n.grade = $1
       ORDER BY n.created_at DESC`,
      [grade, id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Student: عدد الإشعارات غير المقروءة ──────────────────────────────────
router.get('/unread-count', auth('student'), async (req, res) => {
  try {
    const { id, grade } = req.user;
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.id AND nr.student_id = $2
       WHERE (n.grade IS NULL OR n.grade = $1)
         AND nr.student_id IS NULL`,
      [grade, id]
    );
    res.json({ count: result.rows[0].count });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Student: تعليم إشعار كمقروء ──────────────────────────────────────────
router.post('/:id/read', auth('student'), async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO notification_reads (notification_id, student_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Student: تعليم كل الإشعارات كمقروءة ─────────────────────────────────
router.post('/read-all', auth('student'), async (req, res) => {
  try {
    const { id, grade } = req.user;
    await pool.query(
      `INSERT INTO notification_reads (notification_id, student_id)
       SELECT n.id, $2
       FROM notifications n
       WHERE (n.grade IS NULL OR n.grade = $1)
       ON CONFLICT DO NOTHING`,
      [grade, id]
    );
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
