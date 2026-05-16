const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

router.get('/', auth(), async (req, res) => {
  try {
    const raw = (req.query.q || '').trim();
    if (raw.length < 2 || raw.length > 100) return res.json([]);
    const q       = `%${raw}%`;
    const { role, grade } = req.user;
    const isStaff = role === 'teacher' || role === 'assistant';

    const [examsRes, studentsRes, playlistsRes, videosRes] = await Promise.all([
      // Exams
      isStaff
        ? pool.query(`SELECT id, title, description FROM exams WHERE title ILIKE $1 OR description ILIKE $1 ORDER BY title LIMIT 6`, [q])
        : pool.query(`SELECT id, title, description FROM exams WHERE grade=$1 AND (title ILIKE $2 OR description ILIKE $2) ORDER BY title LIMIT 6`, [grade, q]),

      // Students — staff only
      isStaff
        ? pool.query(`SELECT id, name, username FROM students WHERE status='approved' AND (name ILIKE $1 OR username ILIKE $1) ORDER BY name LIMIT 6`, [q])
        : Promise.resolve({ rows: [] }),

      // Top-level playlists
      pool.query(`SELECT id, title, description FROM playlists WHERE parent_id IS NULL AND (title ILIKE $1 OR description ILIKE $1) ORDER BY title LIMIT 6`, [q]),

      // Playlist items (videos / files)
      pool.query(`SELECT id, title, description FROM playlist_items WHERE title ILIKE $1 ORDER BY title LIMIT 6`, [q]),
    ]);

    const results = [
      ...examsRes.rows.map(e => ({ type: 'exam',     id: e.id, title: e.title,    subtitle: e.description || '' })),
      ...studentsRes.rows.map(s => ({ type: 'student',  id: s.id, title: s.name,     subtitle: '@' + s.username })),
      ...playlistsRes.rows.map(p => ({ type: 'playlist', id: p.id, title: p.title,    subtitle: p.description || '' })),
      ...videosRes.rows.map(v => ({ type: 'video',    id: v.id, title: v.title,    subtitle: v.description || '' })),
    ];

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

module.exports = router;
