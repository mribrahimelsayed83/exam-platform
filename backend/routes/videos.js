const router = require('express').Router();
const notify = require('../utils/teacherNotif');
const { notifyGrade } = require('../utils/studentNotif');
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const staff  = auth.staff;

// ── Helper: extract YouTube video ID ─────────────────────────────────────
function getYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// ════════════════════════════════════════
// STUDENT — عرض القوائم والفيديوهات
// ════════════════════════════════════════

// GET /videos/playlists — قوائم الطالب حسب صفه (top-level only)
router.get('/playlists', auth('student'), async (req, res) => {
  try {
    const { grade } = req.user;
    const result = await pool.query(
      `SELECT p.id, p.title, p.description, p.thumbnail, p.position,
              COUNT(v.id)::int AS video_count,
              (SELECT COUNT(*) FROM playlists sp WHERE sp.parent_id = p.id)::int AS sub_count
       FROM playlists p
       LEFT JOIN videos v ON v.playlist_id = p.id
       WHERE p.grade = $1 AND p.parent_id IS NULL
       GROUP BY p.id
       ORDER BY p.position, p.created_at`,
      [grade]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/playlists/:id — فيديوهات أو سب-بلايليستات قائمة معينة
router.get('/playlists/:id', auth('student'), async (req, res) => {
  try {
    const { grade } = req.user;
    const playlist = await pool.query(
      'SELECT * FROM playlists WHERE id=$1 AND grade=$2 AND parent_id IS NULL',
      [req.params.id, grade]
    );
    if (!playlist.rows[0])
      return res.status(404).json({ message: 'القائمة مش موجودة أو مش لصفك' });

    const videos = await pool.query(
      'SELECT id, title, youtube_url, description, position FROM videos WHERE playlist_id=$1 ORDER BY position',
      [req.params.id]
    );
    res.json({ playlist: playlist.rows[0], videos: videos.rows });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/playlists/:id/subs — سب-بلايليستات قائمة للطالب
router.get('/playlists/:id/subs', auth('student'), async (req, res) => {
  try {
    const { grade } = req.user;
    const parent = await pool.query(
      'SELECT * FROM playlists WHERE id=$1 AND grade=$2 AND parent_id IS NULL',
      [req.params.id, grade]
    );
    if (!parent.rows[0])
      return res.status(404).json({ message: 'القائمة مش موجودة أو مش لصفك' });

    const subs = await pool.query(
      `SELECT p.id, p.title, p.description, p.thumbnail, p.position,
              COUNT(pi.id)::int AS item_count
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       WHERE p.parent_id = $1
       GROUP BY p.id
       ORDER BY p.position, p.created_at`,
      [req.params.id]
    );
    res.json({ parent: parent.rows[0], subs: subs.rows });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/playlists/:id/items — محتوى سب-بلايليست للطالب
router.get('/playlists/:id/items', auth('student'), async (req, res) => {
  try {
    const { grade } = req.user;
    // verify this is a sub-playlist whose parent belongs to student's grade
    const sub = await pool.query(
      `SELECT p.*, pp.grade AS parent_grade
       FROM playlists p
       JOIN playlists pp ON pp.id = p.parent_id
       WHERE p.id = $1 AND pp.grade = $2 AND p.parent_id IS NOT NULL`,
      [req.params.id, grade]
    );
    if (!sub.rows[0])
      return res.status(404).json({ message: 'الدرس مش موجود أو مش لصفك' });

    const items = await pool.query(
      `SELECT pi.*, e.title AS exam_title, e.grade AS exam_grade,
              e.duration AS exam_duration, e.pass_score AS exam_pass_score
       FROM playlist_items pi
       LEFT JOIN exams e ON e.id = pi.exam_id
       WHERE pi.playlist_id = $1
       ORDER BY pi.position`,
      [req.params.id]
    );
    res.json({ playlist: sub.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ════════════════════════════════════════
// STAFF — إدارة القوائم والفيديوهات
// ════════════════════════════════════════

// GET /videos/manage/playlists — القوائم الرئيسية للمدرس (top-level only)
router.get('/manage/playlists', staff, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.description, p.thumbnail, p.grade, p.position, p.created_at,
              COUNT(v.id)::int AS video_count,
              (SELECT COUNT(*) FROM playlists sp WHERE sp.parent_id = p.id)::int AS sub_count
       FROM playlists p
       LEFT JOIN videos v ON v.playlist_id = p.id
       WHERE p.parent_id IS NULL
       GROUP BY p.id
       ORDER BY p.grade, p.position, p.created_at`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/manage/playlists/:id — فيديوهات قائمة للمدرس
router.get('/manage/playlists/:id', staff, async (req, res) => {
  try {
    const playlist = await pool.query('SELECT * FROM playlists WHERE id=$1', [req.params.id]);
    if (!playlist.rows[0]) return res.status(404).json({ message: 'مش موجودة' });
    const videos = await pool.query(
      'SELECT * FROM videos WHERE playlist_id=$1 ORDER BY position',
      [req.params.id]
    );
    res.json({ playlist: playlist.rows[0], videos: videos.rows });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /videos/manage/playlists — إنشاء قائمة
router.post('/manage/playlists', staff, async (req, res) => {
  const { title, description, thumbnail, grade } = req.body;
  if (!title || !grade)
    return res.status(400).json({ message: 'العنوان والصف مطلوبان' });
  try {
    // Get max position
    const maxPos = await pool.query('SELECT COALESCE(MAX(position),0) AS m FROM playlists WHERE grade=$1', [grade]);
    const position = maxPos.rows[0].m + 1;
    const result = await pool.query(
      'INSERT INTO playlists (title,description,thumbnail,grade,position) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [title, description||'', thumbnail||'', Number(grade), position]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /videos/manage/playlists/reorder — إعادة ترتيب القوائم (قبل /:id)
router.put('/manage/playlists/reorder', staff, async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) return res.status(400).json({ message: 'ids مطلوبة' });
  try {
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE playlists SET position=$1 WHERE id=$2', [i, ids[i]]);
    }
    res.json({ message: 'تم إعادة الترتيب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /videos/manage/playlists/:id — تعديل قائمة
router.put('/manage/playlists/:id', staff, async (req, res) => {
  const { title, description, thumbnail, grade } = req.body;
  try {
    await pool.query(
      'UPDATE playlists SET title=$1, description=$2, thumbnail=$3, grade=$4 WHERE id=$5',
      [title, description||'', thumbnail||'', Number(grade), req.params.id]
    );
    res.json({ message: 'تم التعديل' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// DELETE /videos/manage/playlists/:id
router.delete('/manage/playlists/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM playlists WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ════════════════════════════════════════
// STAFF — إدارة السب-بلايليستات (الدروس)
// ════════════════════════════════════════

// GET /videos/manage/playlists/:id/subs — سب-بلايليستات قائمة
router.get('/manage/playlists/:id/subs', staff, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.description, p.thumbnail, p.grade, p.position, p.created_at,
              COUNT(pi.id)::int AS item_count
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       WHERE p.parent_id = $1
       GROUP BY p.id
       ORDER BY p.position, p.created_at`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /videos/manage/playlists/:id/subs — إنشاء سب-بلايليست
router.post('/manage/playlists/:id/subs', staff, async (req, res) => {
  const { title, description, thumbnail } = req.body;
  if (!title) return res.status(400).json({ message: 'العنوان مطلوب' });
  try {
    const parent = await pool.query('SELECT grade FROM playlists WHERE id=$1', [req.params.id]);
    if (!parent.rows[0]) return res.status(404).json({ message: 'القائمة الرئيسية مش موجودة' });
    const maxPos = await pool.query(
      'SELECT COALESCE(MAX(position),0) AS m FROM playlists WHERE parent_id=$1',
      [req.params.id]
    );
    const position = maxPos.rows[0].m + 1;
    const result = await pool.query(
      'INSERT INTO playlists (title,description,thumbnail,grade,position,parent_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [title, description||'', thumbnail||'', parent.rows[0].grade, position, req.params.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /videos/manage/playlists/subs/reorder — إعادة ترتيب السب-بلايليستات
router.put('/manage/playlists/subs/reorder', staff, async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) return res.status(400).json({ message: 'ids مطلوبة' });
  try {
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE playlists SET position=$1 WHERE id=$2', [i, ids[i]]);
    }
    res.json({ message: 'تم إعادة الترتيب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ════════════════════════════════════════
// STAFF — إدارة عناصر السب-بلايليست
// ════════════════════════════════════════

// GET /videos/manage/playlists/:id/items — محتوى سب-بلايليست
router.get('/manage/playlists/:id/items', staff, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pi.*, e.title AS exam_title, e.grade AS exam_grade
       FROM playlist_items pi
       LEFT JOIN exams e ON e.id = pi.exam_id
       WHERE pi.playlist_id = $1
       ORDER BY pi.position`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /videos/manage/playlists/:id/items — إضافة عنصر
router.post('/manage/playlists/:id/items', staff, async (req, res) => {
  const { type, title, description, youtube_url, exam_id, file_url, file_name, file_data } = req.body;
  if (!type || !title) return res.status(400).json({ message: 'النوع والعنوان مطلوبان' });
  if (type === 'video') {
    if (!youtube_url) return res.status(400).json({ message: 'رابط YouTube مطلوب' });
    if (!getYouTubeId(youtube_url)) return res.status(400).json({ message: 'رابط YouTube غير صحيح' });
  }
  if (type === 'exam' && !exam_id) return res.status(400).json({ message: 'اختر امتحاناً' });
  try {
    const maxPos = await pool.query(
      'SELECT COALESCE(MAX(position),0) AS m FROM playlist_items WHERE playlist_id=$1',
      [req.params.id]
    );
    const position = maxPos.rows[0].m + 1;
    const result = await pool.query(
      `INSERT INTO playlist_items
         (playlist_id,type,title,description,position,youtube_url,exam_id,file_url,file_name,file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,playlist_id,type,title,description,position,youtube_url,exam_id,file_url,file_name,created_at`,
      [req.params.id, type, title, description||'', position,
       youtube_url||'', exam_id||null, file_url||'', file_name||'', file_data||'']
    );
    const newItem = result.rows[0];
    // fetch playlist grade to target the right students
    const plRes = await pool.query('SELECT grade FROM playlists WHERE id=$1', [req.params.id]);
    if (plRes.rows[0]) {
      const typeLabel = type === 'video' ? '🎬 فيديو جديد' : type === 'file' ? '📎 ملف جديد' : '📝 محتوى جديد';
      notifyGrade(plRes.rows[0].grade, typeLabel, `تم إضافة "${title}" — تفقد الدروس الآن`);
    }
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /videos/manage/items/reorder — إعادة ترتيب العناصر (قبل /:id)
router.put('/manage/items/reorder', staff, async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) return res.status(400).json({ message: 'ids مطلوبة' });
  try {
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE playlist_items SET position=$1 WHERE id=$2', [i, ids[i]]);
    }
    res.json({ message: 'تم إعادة الترتيب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /videos/manage/items/:id — تعديل عنصر
router.put('/manage/items/:id', staff, async (req, res) => {
  const { title, description, youtube_url, exam_id, file_url, file_name, file_data } = req.body;
  if (youtube_url && !getYouTubeId(youtube_url))
    return res.status(400).json({ message: 'رابط YouTube غير صحيح' });
  try {
    // Only update file_data if provided (avoid overwriting with empty on edit)
    if (file_data !== undefined && file_data !== '') {
      await pool.query(
        `UPDATE playlist_items
         SET title=$1,description=$2,youtube_url=$3,exam_id=$4,file_url=$5,file_name=$6,file_data=$7
         WHERE id=$8`,
        [title, description||'', youtube_url||'', exam_id||null,
         file_url||'', file_name||'', file_data, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE playlist_items
         SET title=$1,description=$2,youtube_url=$3,exam_id=$4,file_url=$5,file_name=$6
         WHERE id=$7`,
        [title, description||'', youtube_url||'', exam_id||null,
         file_url||'', file_name||'', req.params.id]
      );
    }
    res.json({ message: 'تم التعديل' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/manage/items/:id/download — تنزيل ملف مرفوع
router.get('/manage/items/:id/download', staff, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_name, file_data FROM playlist_items WHERE id=$1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'مش موجود' });
    res.json({ file_name: result.rows[0].file_name, file_data: result.rows[0].file_data });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/items/:id/download — تنزيل ملف للطالب
router.get('/items/:id/download', auth('student'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_name, file_data FROM playlist_items WHERE id=$1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'مش موجود' });
    res.json({ file_name: result.rows[0].file_name, file_data: result.rows[0].file_data });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// DELETE /videos/manage/items/:id — حذف عنصر
router.delete('/manage/items/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM playlist_items WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/manage/exams-list — قائمة الامتحانات للإضافة في السب-بلايليست
router.get('/manage/exams-list', staff, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, grade FROM exams WHERE is_active=TRUE ORDER BY grade, created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /videos/manage/playlists/:id/videos — إضافة فيديو
router.post('/manage/playlists/:id/videos', staff, async (req, res) => {
  const { title, youtube_url, description } = req.body;
  if (!title || !youtube_url)
    return res.status(400).json({ message: 'العنوان والرابط مطلوبان' });
  const videoId = getYouTubeId(youtube_url);
  if (!videoId)
    return res.status(400).json({ message: 'رابط YouTube غير صحيح' });
  try {
    const maxPos = await pool.query(
      'SELECT COALESCE(MAX(position),0) AS m FROM videos WHERE playlist_id=$1',
      [req.params.id]
    );
    const position = maxPos.rows[0].m + 1;
    const result = await pool.query(
      'INSERT INTO videos (playlist_id,title,youtube_url,description,position) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, title, youtube_url, description||'', position]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /videos/manage/videos/reorder — إعادة ترتيب الفيديوهات (قبل /:id)
router.put('/manage/videos/reorder', staff, async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) return res.status(400).json({ message: 'ids مطلوبة' });
  try {
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE videos SET position=$1 WHERE id=$2', [i, ids[i]]);
    }
    res.json({ message: 'تم إعادة الترتيب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /videos/manage/videos/:id — تعديل فيديو
router.put('/manage/videos/:id', staff, async (req, res) => {
  const { title, youtube_url, description } = req.body;
  if (youtube_url && !getYouTubeId(youtube_url))
    return res.status(400).json({ message: 'رابط YouTube غير صحيح' });
  try {
    await pool.query(
      'UPDATE videos SET title=$1, youtube_url=$2, description=$3 WHERE id=$4',
      [title, youtube_url, description||'', req.params.id]
    );
    res.json({ message: 'تم التعديل' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// DELETE /videos/manage/videos/:id
router.delete('/manage/videos/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM videos WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── POST /videos/view — student records opening a video/item ──────────────
router.post('/view', auth('student'), async (req, res) => {
  const { item_id, title } = req.body;
  const studentId = req.user.id;
  try {
    await pool.query(
      `INSERT INTO video_views (student_id, item_id, title) VALUES ($1, $2, $3)`,
      [studentId, item_id || null, title || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'خطأ' });
  }
});

module.exports = router;

// ════════════════════════════════════════
// LIKES
// ════════════════════════════════════════

// POST /videos/:id/like — toggle like
router.post('/:id/like', auth('student'), async (req, res) => {
  try {
    const exists = await pool.query(
      'SELECT 1 FROM video_likes WHERE video_id=$1 AND student_id=$2',
      [req.params.id, req.user.id]
    );
    if (exists.rows.length) {
      await pool.query(
        'DELETE FROM video_likes WHERE video_id=$1 AND student_id=$2',
        [req.params.id, req.user.id]
      );
      res.json({ liked: false });
    } else {
      await pool.query(
        'INSERT INTO video_likes (video_id, student_id) VALUES ($1,$2)',
        [req.params.id, req.user.id]
      );
      // notify on like
      const vRes = await pool.query('SELECT title FROM videos WHERE id=$1',[req.params.id]);
      const stuRes = await pool.query('SELECT name FROM students WHERE id=$1',[req.user.id]);
      notify('like','❤️ لايك جديد',
        `${stuRes.rows[0]?.name} عمل لايك للفيديو "${vRes.rows[0]?.title}"`,
        'video', Number(req.params.id));
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/:id/likes — عدد اللايكات + هل الطالب عمل لايك
router.get('/:id/likes', auth('student'), async (req, res) => {
  try {
    const count = await pool.query(
      'SELECT COUNT(*)::int AS count FROM video_likes WHERE video_id=$1',
      [req.params.id]
    );
    const mine = await pool.query(
      'SELECT 1 FROM video_likes WHERE video_id=$1 AND student_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ count: count.rows[0].count, liked: mine.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ════════════════════════════════════════
// COMMENTS
// ════════════════════════════════════════

// GET /videos/:id/comments
router.get('/:id/comments', auth('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.body, c.created_at, s.name AS student_name
       FROM video_comments c
       JOIN students s ON s.id = c.student_id
       WHERE c.video_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /videos/:id/comments
router.post('/:id/comments', auth('student'), async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ message: 'الكومنت فاضي' });
  try {
    const result = await pool.query(
      `INSERT INTO video_comments (video_id, student_id, body) VALUES ($1,$2,$3)
       RETURNING id, body, created_at`,
      [req.params.id, req.user.id, body.trim()]
    );
    // notify on comment
    const vRes2 = await pool.query('SELECT title FROM videos WHERE id=$1',[req.params.id]);
    notify('comment','💬 تعليق جديد',
      `${req.user.name} علّق على "${vRes2.rows[0]?.title}": ${body.trim().slice(0,60)}...`,
      'video', Number(req.params.id));
    res.status(201).json({
      ...result.rows[0],
      student_name: req.user.name
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /videos/manage/:id/comments — للمدرس
router.get('/manage/:id/comments', staff, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.body, c.created_at, s.name AS student_name, s.grade
       FROM video_comments c
       JOIN students s ON s.id = c.student_id
       WHERE c.video_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// DELETE /videos/manage/comments/:id — المدرس يحذف كومنت
router.delete('/manage/comments/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM video_comments WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});
