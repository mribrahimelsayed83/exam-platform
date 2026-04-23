const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');
const notify  = require('../utils/teacherNotif');

const staff = (req, res, next) => {
  auth('teacher')(req, res, (err) => {
    if (!err && req.user) return next();
    auth('assistant')(req, res, next);
  });
};

// ── Student: get my messages (marks teacher messages as read) ─────────────
router.get('/messages', auth('student'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chat_messages WHERE student_id=$1 ORDER BY created_at ASC`,
      [req.user.id]
    );
    await pool.query(
      `UPDATE chat_messages SET is_read=TRUE
       WHERE student_id=$1 AND from_role IN ('teacher','assistant')`,
      [req.user.id]
    );
    res.json(rows);
  } catch { res.status(500).json({ message: 'خطأ' }); }
});

// ── Student: send message ─────────────────────────────────────────────────
router.post('/send', auth('student'), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'الرسالة فارغة' });
    const { rows } = await pool.query(
      `INSERT INTO chat_messages (student_id, from_role, from_name, message)
       VALUES ($1,'student',$2,$3) RETURNING *`,
      [req.user.id, req.user.name, message.trim()]
    );
    notify('comment', `💬 رسالة من ${req.user.name}`, message.trim().slice(0, 100), 'student', req.user.id);
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ message: 'خطأ' }); }
});

// ── Student: unread count (from teacher/assistant) ────────────────────────
router.get('/unread-count', auth('student'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM chat_messages
       WHERE student_id=$1 AND from_role IN ('teacher','assistant') AND is_read=FALSE`,
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch { res.status(500).json({ count: 0 }); }
});

// ══ TEACHER ROUTES — specific paths BEFORE parameterized /:studentId ══════

// ── Teacher: all conversations ────────────────────────────────────────────
router.get('/teacher/conversations', staff, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         s.id AS student_id, s.name AS student_name,
         COUNT(m.id) FILTER (WHERE m.from_role='student' AND m.is_read=FALSE) AS unread,
         MAX(m.created_at) AS last_at,
         (SELECT message FROM chat_messages
          WHERE student_id=s.id ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM students s
       JOIN chat_messages m ON m.student_id = s.id
       GROUP BY s.id, s.name
       ORDER BY last_at DESC`
    );
    res.json(rows);
  } catch { res.status(500).json([]); }
});

// ── Teacher: unread count ─────────────────────────────────────────────────
router.get('/teacher/unread-count', staff, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM chat_messages
       WHERE from_role='student' AND is_read=FALSE`
    );
    res.json({ count: rows[0].count });
  } catch { res.status(500).json({ count: 0 }); }
});

// ── Teacher: search students + assistants ─────────────────────────────────
router.get('/teacher/search', staff, async (req, res) => {
  try {
    const q = `%${(req.query.q || '').trim()}%`;
    const [s, a] = await Promise.all([
      pool.query(`SELECT id, name, username, 'student' AS role FROM students WHERE status='approved' AND (name ILIKE $1 OR username ILIKE $1)`, [q]),
      pool.query(`SELECT id, name, username, 'assistant' AS role FROM assistants WHERE (name ILIKE $1 OR username ILIKE $1)`, [q]),
    ]);
    res.json([...s.rows, ...a.rows]);
  } catch { res.status(500).json([]); }
});

// ── Teacher: staff conversations list ────────────────────────────────────
router.get('/teacher/staff-conversations', staff, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         a.id AS assistant_id, a.name AS assistant_name,
         COUNT(m.id) FILTER (WHERE m.from_role='assistant' AND m.is_read=FALSE) AS unread,
         MAX(m.created_at) AS last_at,
         (SELECT message FROM staff_messages
          WHERE (from_id=a.id AND from_role='assistant')
             OR (to_id=a.id AND to_role='assistant')
          ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM assistants a
       JOIN staff_messages m ON (m.from_id=a.id AND m.from_role='assistant')
                              OR (m.to_id=a.id AND m.to_role='assistant')
       GROUP BY a.id, a.name
       ORDER BY last_at DESC`
    );
    res.json(rows);
  } catch { res.status(500).json([]); }
});

// ── Teacher: messages for one student — MUST be after specific routes above ─
router.get('/teacher/:studentId', staff, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chat_messages WHERE student_id=$1 ORDER BY created_at ASC`,
      [req.params.studentId]
    );
    await pool.query(
      `UPDATE chat_messages SET is_read=TRUE
       WHERE student_id=$1 AND from_role='student'`,
      [req.params.studentId]
    );
    res.json(rows);
  } catch { res.status(500).json([]); }
});

// ── Teacher: reply to student ─────────────────────────────────────────────
router.post('/teacher/:studentId/reply', staff, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'الرسالة فارغة' });
    const { rows } = await pool.query(
      `INSERT INTO chat_messages (student_id, from_role, from_name, message)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.studentId, req.user.role, req.user.name, message.trim()]
    );
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ message: 'خطأ' }); }
});

// ── Teacher: messages with assistant ─────────────────────────────────────
router.get('/staff/:assistantId', staff, async (req, res) => {
  try {
    const aid = req.params.assistantId;
    const { rows } = await pool.query(
      `SELECT * FROM staff_messages
       WHERE (from_role='assistant' AND from_id=$1)
          OR (to_role='assistant' AND to_id=$1)
       ORDER BY created_at ASC`, [aid]
    );
    await pool.query(
      `UPDATE staff_messages SET is_read=TRUE
       WHERE from_id=$1 AND from_role='assistant' AND is_read=FALSE`, [aid]
    );
    res.json(rows);
  } catch { res.status(500).json([]); }
});

// ── Teacher: send to assistant ────────────────────────────────────────────
router.post('/staff/:assistantId/send', staff, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'الرسالة فارغة' });
    const aRes = await pool.query('SELECT name FROM assistants WHERE id=$1', [req.params.assistantId]);
    if (!aRes.rows[0]) return res.status(404).json({ message: 'مساعد غير موجود' });
    const { rows } = await pool.query(
      `INSERT INTO staff_messages (from_id, from_role, from_name, to_id, to_role, to_name, message)
       VALUES ($1,$2,$3,$4,'assistant',$5,$6) RETURNING *`,
      [req.user.id, req.user.role, req.user.name,
       req.params.assistantId, aRes.rows[0].name, message.trim()]
    );
    res.status(201).json(rows[0]);
  } catch { res.status(500).json({ message: 'خطأ' }); }
});

module.exports = router;
