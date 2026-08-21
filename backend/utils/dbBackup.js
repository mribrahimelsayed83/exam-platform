const zlib   = require('zlib');
const { Resend } = require('resend');
const pool   = require('../db/pool');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.FROM_EMAIL   || 'onboarding@resend.dev';
// BACKUP_EMAIL may be a single address or several comma-separated ones.
const TO     = (process.env.BACKUP_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean);

// Core business data — excludes push_subscriptions (ephemeral browser state)
// and landing_settings (cosmetic content with large embedded images, not
// data that would be painful to redo by hand if ever lost).
const TABLES = [
  'teachers', 'assistants', 'students',
  'exams', 'questions', 'submissions',
  'playlists', 'videos', 'playlist_items', 'exam_lists',
  'notifications', 'notification_reads', 'teacher_notifications',
  'video_views', 'video_likes', 'video_comments',
  'payments', 'personal_exam_submissions',
  'chat_messages', 'staff_messages',
];

// Throws on any failure (misconfiguration, DB error, or a Resend API-level
// error — the Resend SDK resolves with { error } instead of rejecting, so
// that has to be checked explicitly). Callers decide how to handle it:
// the nightly scheduler logs and swallows it, the manual route lets it
// surface as a real failure response instead of a false "sent" message.
async function runBackup() {
  if (!process.env.RESEND_API_KEY || TO.length === 0) {
    throw new Error('RESEND_API_KEY أو BACKUP_EMAIL غير مضبوطين');
  }

  const tables = {};
  for (const table of TABLES) {
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    tables[table] = rows;
  }
  const json  = JSON.stringify({ generatedAt: new Date().toISOString(), tables });
  const gz    = zlib.gzipSync(json);
  const today = new Date().toISOString().slice(0, 10);

  const result = await resend.emails.send({
    from: FROM,
    to:   TO,
    subject: `💾 نسخة احتياطية يومية — ${today}`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
        <h2 style="color:#2563eb">نسخة احتياطية تلقائية</h2>
        <p>نسخة احتياطية كاملة من بيانات المنصة (الطلاب، الامتحانات، الإجابات، المدفوعات، وغيرها) بتاريخ ${today}.</p>
        <p style="color:#666;font-size:13px">الملف المرفق مضغوط (gzip) بصيغة JSON — احتفظ به في مكان آمن. لو احتجت استرجاع البيانات يومًا، ابعت الملف ده.</p>
      </div>
    `,
    attachments: [{ filename: `backup-${today}.json.gz`, content: gz.toString('base64') }],
  });

  if (result.error) throw new Error(result.error.message || 'Resend API error');
  console.log(`✅ Database backup emailed to ${TO} (${(gz.length / 1024).toFixed(0)} KB)`);
}

// Checks hourly; fires once per UTC calendar day at the target hour.
// Interval-based (not a cron lib) since this is a single always-on process —
// tracking lastRunDate keeps a redeploy/restart from re-sending same-day.
function scheduleDailyBackup() {
  const TARGET_HOUR_UTC = 1; // ~3 AM Cairo time (UTC+2)
  let lastRunDate = null;
  setInterval(() => {
    const now   = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getUTCHours() === TARGET_HOUR_UTC && lastRunDate !== today) {
      lastRunDate = today;
      runBackup().catch(err => console.error('❌ Nightly backup failed:', err.message));
    }
  }, 60 * 60 * 1000);
}

module.exports = { runBackup, scheduleDailyBackup };
