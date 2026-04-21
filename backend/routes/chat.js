const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');
const notify  = require('../utils/teacherNotif');

const staff = [auth('teacher'), auth('assistant')].reduce(
  (_, m) => (req, res, next) => {
    auth('teacher')(req, res, (err) => {
      if (!err && req.user) return next();
      auth('assistant')(req, res, next);
    });
  },
  null
);

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

// ── Teacher: get all conversations (one row per student) ──────────────────
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

// ── Teacher: unread count across all students ─────────────────────────────
router.get('/teacher/unread-count', staff, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM chat_messages
       WHERE from_role='student' AND is_read=FALSE`
    );
    res.json({ count: rows[0].count });
  } catch { res.status(500).json({ count: 0 }); }
});

// ── Teacher: get messages for one student (marks student messages as read) ─
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

module.exports = router;
