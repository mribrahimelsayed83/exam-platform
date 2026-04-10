const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');

// GET /landing — public
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM landing_settings WHERE id=1');
    if (!result.rows[0]) return res.status(404).json({ message: 'not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// PUT /landing — teacher only
router.put('/', auth('teacher'), async (req, res) => {
  const {
    hero_name, hero_title, hero_desc, hero_image, hero_bg_color,
    stat1_num, stat1_label, stat2_num, stat2_label,
    stat3_num, stat3_label, stat4_num, stat4_label,
    features, testimonials,
    cta_title, cta_desc,
    whatsapp, telegram, facebook, youtube,
    platform_tagline,
  } = req.body;

  try {
    await pool.query(
      `UPDATE landing_settings SET
        hero_name=$1, hero_title=$2, hero_desc=$3, hero_image=$4, hero_bg_color=$5,
        stat1_num=$6, stat1_label=$7, stat2_num=$8, stat2_label=$9,
        stat3_num=$10, stat3_label=$11, stat4_num=$12, stat4_label=$13,
        features=$14, testimonials=$15,
        cta_title=$16, cta_desc=$17,
        whatsapp=$18, telegram=$19, facebook=$20, youtube=$21,
        platform_tagline=$22, updated_at=NOW()
       WHERE id=1`,
      [
        hero_name, hero_title, hero_desc, hero_image||'', hero_bg_color||'#2563eb',
        stat1_num, stat1_label, stat2_num, stat2_label,
        stat3_num, stat3_label, stat4_num, stat4_label,
        JSON.stringify(features), JSON.stringify(testimonials),
        cta_title, cta_desc,
        whatsapp||'', telegram||'', facebook||'', youtube||'',
        platform_tagline,
      ]
    );
    res.json({ message: 'تم حفظ الإعدادات' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
