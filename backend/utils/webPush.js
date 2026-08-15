const webpush = require('web-push');
const pool    = require('../db/pool');

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const enabled = !!(PUBLIC_KEY && PRIVATE_KEY);

if (enabled) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || 'support@mribrahimfarouk.com'}`,
    PUBLIC_KEY, PRIVATE_KEY
  );
} else {
  console.warn('⚠️  VAPID keys not configured — push notifications disabled');
}

async function sendToSubscriptions(subs, payload) {
  if (!enabled || !subs.length) return;
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      );
    } catch (err) {
      // 404/410 = subscription expired or was revoked by the browser — clean it up.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [sub.endpoint]).catch(() => {});
      } else {
        console.error('web-push send error:', err.message);
      }
    }
  }));
}

async function pushToUser(role, userId, payload) {
  if (!enabled) return;
  const { rows } = await pool.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_role=$1 AND user_id=$2',
    [role, userId]
  );
  return sendToSubscriptions(rows, payload);
}

// grade === null/undefined pushes to every student, matching notifyGrade's own convention.
async function pushToGrade(grade, payload) {
  if (!enabled) return;
  const { rows } = await pool.query(
    `SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps
     JOIN students s ON s.id = ps.user_id
     WHERE ps.user_role='student' AND ($1::int IS NULL OR s.grade=$1)`,
    [grade || null]
  );
  return sendToSubscriptions(rows, payload);
}

async function pushToStaff(payload) {
  if (!enabled) return;
  const { rows } = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_role IN ('teacher','assistant')`
  );
  return sendToSubscriptions(rows, payload);
}

module.exports = { pushToUser, pushToGrade, pushToStaff, enabled };
