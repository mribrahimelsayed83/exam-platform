const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');

function safeUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (/^(javascript|data|vbscript):/i.test(s)) return '';
  return s;
}

function serveBase64Image(res, base64str) {
  if (!base64str) return res.status(404).end();
  const mimeMatch = base64str.match(/^data:(image\/\w+);base64,/);
  if (!mimeMatch) return res.status(404).end();
  const mimeType   = mimeMatch[1];
  const base64Data = base64str.slice(mimeMatch[0].length);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  res.send(Buffer.from(base64Data, 'base64'));
}

// GET /landing — public (base64 stripped, images served as absolute URLs)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM landing_settings WHERE id=1');
    if (!result.rows[0]) return res.status(404).json({ message: 'not found' });
    const d = { ...result.rows[0] };

    // Build absolute base URL — use x-forwarded-proto so HTTPS is preserved behind Railway's proxy
    const proto   = (req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim();
    const host    = req.headers['x-forwarded-host']   || req.get('host');
    const baseUrl = `${proto}://${host}`;

    // Replace base64 hero_image with absolute URL
    if (d.hero_image?.startsWith('data:')) {
      d.hero_image = `${baseUrl}/api/landing/hero-image`;
    }

    // Replace base64 gallery items with absolute URLs
    try {
      const gallery = JSON.parse(d.gallery || '[]');
      d.gallery = JSON.stringify(
        gallery.map((img, i) =>
          img?.startsWith('data:') ? `${baseUrl}/api/landing/gallery/${i}` : img
        )
      );
    } catch {}

    // og_image not needed in public JSON response
    delete d.og_image;

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(d);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /landing/editor — teacher only (full data including base64)
router.get('/editor', auth('teacher'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM landing_settings WHERE id=1');
    if (!result.rows[0]) return res.status(404).json({ message: 'not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /landing/hero-image — public binary
router.get('/hero-image', async (req, res) => {
  try {
    const { rows: [row] } = await pool.query('SELECT hero_image FROM landing_settings WHERE id=1');
    serveBase64Image(res, row?.hero_image);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

// GET /landing/gallery/:index — public binary
router.get('/gallery/:index', async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0) return res.status(400).end();
    const { rows: [row] } = await pool.query('SELECT gallery FROM landing_settings WHERE id=1');
    const gallery = JSON.parse(row?.gallery || '[]');
    serveBase64Image(res, gallery[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

// GET /landing/og-image — public binary
router.get('/og-image', async (req, res) => {
  try {
    const { rows: [row] } = await pool.query('SELECT og_image FROM landing_settings WHERE id=1');
    serveBase64Image(res, row?.og_image);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

// GET /landing/courses — public
router.get('/courses', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.title, p.description, p.thumbnail, p.grade, p.position,
              (SELECT COUNT(*) FROM playlists sub WHERE sub.parent_id = p.id)::int AS lessons_count,
              (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id)::int  AS items_count
       FROM playlists p
       WHERE p.parent_id IS NULL AND p.show_on_landing = TRUE
       ORDER BY p.grade, p.position, p.created_at`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /landing — teacher only.
// Text/JSON config only — hero_image, gallery and og_image are intentionally
// NOT accepted here. They go through their own dedicated endpoints below so
// that editing a title doesn't re-upload tens of MB of unrelated base64
// images on every save (that was making saves slow and occasionally trip
// the request body-size limit).
router.put('/', auth('teacher'), async (req, res) => {
  const {
    hero_name, hero_title, hero_desc, hero_bg_color,
    stat1_num, stat1_label, stat2_num, stat2_label,
    stat3_num, stat3_label, stat4_num, stat4_label,
    features, testimonials, gallery_interval,
    cta_title, cta_desc,
    whatsapp, telegram, facebook, youtube,
    platform_tagline, sections_config,
  } = req.body;

  try {
    await pool.query(
      `UPDATE landing_settings SET
        hero_name=$1, hero_title=$2, hero_desc=$3, hero_bg_color=$4,
        stat1_num=$5, stat1_label=$6, stat2_num=$7, stat2_label=$8,
        stat3_num=$9, stat3_label=$10, stat4_num=$11, stat4_label=$12,
        features=$13, testimonials=$14,
        cta_title=$15, cta_desc=$16,
        whatsapp=$17, telegram=$18, facebook=$19, youtube=$20,
        platform_tagline=$21, gallery_interval=$22,
        sections_config=$23, updated_at=NOW()
       WHERE id=1`,
      [
        hero_name, hero_title, hero_desc, hero_bg_color||'#2563eb',
        stat1_num, stat1_label, stat2_num, stat2_label,
        stat3_num, stat3_label, stat4_num, stat4_label,
        JSON.stringify(features), JSON.stringify(testimonials),
        cta_title, cta_desc,
        safeUrl(whatsapp), safeUrl(telegram), safeUrl(facebook), safeUrl(youtube),
        platform_tagline,
        Number(gallery_interval) || 2,
        JSON.stringify(Array.isArray(sections_config) ? sections_config : []),
      ]
    );
    res.json({ message: 'تم حفظ الإعدادات' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /landing/hero-image — teacher only, upload/clear hero photo in isolation
router.put('/hero-image', auth('teacher'), async (req, res) => {
  try {
    await pool.query('UPDATE landing_settings SET hero_image=$1, updated_at=NOW() WHERE id=1', [req.body.hero_image || '']);
    res.json({ message: 'تم حفظ الصورة' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /landing/og-image — teacher only, upload/clear share-preview image in isolation
router.put('/og-image', auth('teacher'), async (req, res) => {
  try {
    await pool.query('UPDATE landing_settings SET og_image=$1, updated_at=NOW() WHERE id=1', [req.body.og_image || '']);
    res.json({ message: 'تم حفظ الصورة' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// POST /landing/gallery — teacher only, append one image (read-modify-write
// server-side so the client never needs to resend the whole gallery array)
router.post('/gallery', auth('teacher'), async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ message: 'الصورة مطلوبة' });
  try {
    const { rows: [row] } = await pool.query('SELECT gallery FROM landing_settings WHERE id=1');
    const gallery = JSON.parse(row?.gallery || '[]');
    gallery.push(image);
    await pool.query('UPDATE landing_settings SET gallery=$1, updated_at=NOW() WHERE id=1', [JSON.stringify(gallery)]);
    res.status(201).json({ message: 'تمت الإضافة', count: gallery.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// DELETE /landing/gallery/:index — teacher only, remove one image by index
router.delete('/gallery/:index', auth('teacher'), async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0) return res.status(400).json({ message: 'index غير صحيح' });
  try {
    const { rows: [row] } = await pool.query('SELECT gallery FROM landing_settings WHERE id=1');
    const gallery = JSON.parse(row?.gallery || '[]');
    gallery.splice(idx, 1);
    await pool.query('UPDATE landing_settings SET gallery=$1, updated_at=NOW() WHERE id=1', [JSON.stringify(gallery)]);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// GET /landing/honor-board — public
router.get('/honor-board', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.name, s.grade,
              COUNT(sub.id)::int                                     AS exam_count,
              ROUND(AVG(sub.final_score))::int                       AS avg_score,
              (COUNT(sub.id) * ROUND(AVG(sub.final_score)))::int     AS honor_score,
              ROW_NUMBER() OVER (
                ORDER BY (COUNT(sub.id) * ROUND(AVG(sub.final_score))) DESC
              )::int                                                 AS rank
       FROM students s
       JOIN submissions sub ON sub.student_id = s.id
       WHERE sub.final_score IS NOT NULL AND s.status = 'approved'
       GROUP BY s.id, s.name, s.grade
       ORDER BY honor_score DESC
       LIMIT 5`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
