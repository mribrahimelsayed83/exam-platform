const pool = require('../db/pool');
const { pushToUser } = require('./webPush');

// Exams closing within the next 24h — nudge students in that grade who
// haven't submitted yet, once per exam (tracked in exam_deadline_reminders
// so a student never gets the same exam's reminder twice, no matter how
// many times the daily job runs while it's still in that window).
async function sendExamDeadlineReminders() {
  const { rows: exams } = await pool.query(`
    SELECT id, title, grade FROM exams
    WHERE is_active = TRUE AND ends_at IS NOT NULL
      AND ends_at > NOW() AND ends_at <= NOW() + INTERVAL '24 hours'
  `);
  for (const exam of exams) {
    const { rows: students } = await pool.query(`
      SELECT s.id FROM students s
      WHERE s.status='approved' AND s.grade=$1
        AND NOT EXISTS (SELECT 1 FROM submissions sub WHERE sub.exam_id=$2 AND sub.student_id=s.id)
        AND NOT EXISTS (SELECT 1 FROM exam_deadline_reminders r WHERE r.exam_id=$2 AND r.student_id=s.id)
    `, [exam.grade, exam.id]);
    for (const student of students) {
      await pushToUser('student', student.id, {
        title: '⏰ تذكير بامتحان قريب',
        body: `امتحان "${exam.title}" هيقفل خلال 24 ساعة — متفوتش الفرصة!`,
        url: '/student?tab=exams',
      });
      await pool.query(
        `INSERT INTO exam_deadline_reminders (exam_id, student_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [exam.id, student.id]
      );
    }
  }
}

// Approved students inactive 7+ days (and past their first week, so brand
// new registrations aren't nagged immediately) — reminded at most once a
// week each via last_inactivity_reminder_at.
async function sendInactivityReminders() {
  const { rows: students } = await pool.query(`
    SELECT id FROM students
    WHERE status='approved'
      AND created_at < NOW() - INTERVAL '7 days'
      AND (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '7 days')
      AND (last_inactivity_reminder_at IS NULL OR last_inactivity_reminder_at < NOW() - INTERVAL '7 days')
  `);
  for (const student of students) {
    await pushToUser('student', student.id, {
      title: '👋 وحشتنا!',
      body: 'مذاكرتش من فترة — يلا ارجع كمّل المذاكرة والامتحانات مستنياك',
      url: '/student',
    });
    await pool.query(`UPDATE students SET last_inactivity_reminder_at=NOW() WHERE id=$1`, [student.id]);
  }
}

async function runReminders() {
  try { await sendExamDeadlineReminders(); } catch (err) { console.error('Exam deadline reminder error:', err.message); }
  try { await sendInactivityReminders(); }   catch (err) { console.error('Inactivity reminder error:', err.message); }
}

// Checks hourly; fires once per UTC calendar day at the target hour —
// same interval-based approach as the nightly backup, for the same reason
// (single always-on process, no cron lib needed).
function scheduleDailyReminders() {
  const TARGET_HOUR_UTC = 15; // ~5 PM Cairo time — students are likely to see it
  let lastRunDate = null;
  setInterval(() => {
    const now   = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getUTCHours() === TARGET_HOUR_UTC && lastRunDate !== today) {
      lastRunDate = today;
      runReminders();
    }
  }, 60 * 60 * 1000);
}

module.exports = { runReminders, scheduleDailyReminders };
