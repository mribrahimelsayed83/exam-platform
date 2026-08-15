const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const { enabled } = require('../utils/webPush');

// ── GET /push/vapid-public-key — public, frontend needs it to subscribe ────
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: enabled ? process.env.VAPID_PUBLIC_KEY : null });
});

// ── POST /push/subscribe — any logged-in role saves its browser subscription ─
router.post('/subscribe', auth(), async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ message: 'اشتراك غير صالح' });
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_role, user_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (endpoint) DO UPDATE SET user_role=$1, user_id=$2, p256dh=$4, auth=$5`,
      [req.user.role, req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.status(201).json({ message: 'تم تفعيل التنبيهات' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── POST /push/unsubscribe ──────────────────────────────────────────────────
router.post('/unsubscribe', auth(), async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ message: 'endpoint مطلوب' });
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [endpoint, req.user.id]);
    res.json({ message: 'تم إيقاف التنبيهات' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
