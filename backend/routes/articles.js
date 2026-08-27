const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const staff  = auth.staff;
const perm   = auth.permission('articles');

// ════════════════════════════════════════
// STUDENT — قراءة المقالات (بس لو القسم مفعّل من إعدادات المدرّس)
// ════════════════════════════════════════

// GET /articles — القائمة (المنشورة فقط)، مع علم enabled عشان الواجهة
// تعرف تخفي القسم كله لو المدرّس مقفّله
router.get('/', auth('student'), async (req, res) => {
  try {
    const { rows: [settings] } = await pool.query(
      `SELECT t.articles_enabled FROM students s
       LEFT JOIN teachers t ON t.id = s.approved_by
       WHERE s.id=$1`,
      [req.user.id]
    );
    if (!settings?.articles_enabled) return res.json({ enabled: false, articles: [] });

    const { rows } = await pool.query(
      `SELECT id, title, summary, cover_image, created_at
       FROM articles WHERE is_published = TRUE
       ORDER BY position, created_at DESC`
    );
    res.json({ enabled: true, articles: rows });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ════════════════════════════════════════
// STAFF — إدارة المقالات (يحتاج صلاحية 'articles' — المدرّس دايمًا عنده)
// ════════════════════════════════════════
// ملحوظة: راوتس /manage/* لازم تتسجّل قبل GET /:id تحت عشان "manage" ميتفسرش
// كـ :id لو اتسجّل الراوت العام الأول.

router.get('/manage/all', staff, perm, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM articles ORDER BY position, created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.get('/manage/:id', staff, perm, async (req, res) => {
  try {
    const { rows: [article] } = await pool.query('SELECT * FROM articles WHERE id=$1', [req.params.id]);
    if (!article) return res.status(404).json({ message: 'المقال مش موجود' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.post('/manage', staff, perm, async (req, res) => {
  const { title, summary, content, cover_image } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: 'العنوان مطلوب' });
  try {
    const maxPos = await pool.query('SELECT COALESCE(MAX(position),0) AS m FROM articles');
    const position = maxPos.rows[0].m + 1;
    const { rows: [article] } = await pool.query(
      `INSERT INTO articles (title, summary, content, cover_image, position)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title.trim(), summary || '', content || '', cover_image || '', position]
    );
    res.status(201).json(article);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.put('/manage/reorder', staff, perm, async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) return res.status(400).json({ message: 'ids مطلوبة' });
  try {
    for (let i = 0; i < ids.length; i++) {
      await pool.query('UPDATE articles SET position=$1 WHERE id=$2', [i, ids[i]]);
    }
    res.json({ message: 'تم إعادة الترتيب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.put('/manage/:id', staff, perm, async (req, res) => {
  const { title, summary, content, cover_image } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: 'العنوان مطلوب' });
  try {
    await pool.query(
      `UPDATE articles SET title=$1, summary=$2, content=$3, cover_image=$4, updated_at=NOW() WHERE id=$5`,
      [title.trim(), summary || '', content || '', cover_image || '', req.params.id]
    );
    res.json({ message: 'تم التعديل' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PATCH /articles/manage/:id/publish — نشر/إخفاء مقال بعينه (منفصل عن تفعيل القسم كله)
router.patch('/manage/:id/publish', staff, perm, async (req, res) => {
  try {
    const { rows: [article] } = await pool.query(
      `UPDATE articles SET is_published = NOT is_published, updated_at = NOW() WHERE id=$1 RETURNING is_published`,
      [req.params.id]
    );
    if (!article) return res.status(404).json({ message: 'المقال مش موجود' });
    res.json({ is_published: article.is_published });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.delete('/manage/:id', staff, perm, async (req, res) => {
  try {
    await pool.query('DELETE FROM articles WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /articles/:id — مقال واحد للطالب (منشور فقط) — لازم يفضل آخر راوت GET
// في الملف عشان معدّيش يبلع /manage/* بغلط.
router.get('/:id', auth('student'), async (req, res) => {
  try {
    const { rows: [settings] } = await pool.query(
      `SELECT t.articles_enabled FROM students s
       LEFT JOIN teachers t ON t.id = s.approved_by
       WHERE s.id=$1`,
      [req.user.id]
    );
    if (!settings?.articles_enabled) return res.status(404).json({ message: 'القسم غير متاح حاليًا' });

    const { rows: [article] } = await pool.query(
      `SELECT id, title, summary, content, cover_image, created_at
       FROM articles WHERE id=$1 AND is_published = TRUE`,
      [req.params.id]
    );
    if (!article) return res.status(404).json({ message: 'المقال مش موجود' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
