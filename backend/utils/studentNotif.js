const pool = require('../db/pool');
const { pushToGrade, pushToUser } = require('./webPush');

// Send notification to all students of a specific grade (or all grades if grade=null)
async function notifyGrade(grade, title, body) {
  try {
    await pool.query(
      `INSERT INTO notifications (title, body, grade) VALUES ($1, $2, $3)`,
      [title, body, grade || null]
    );
    pushToGrade(grade, { title, body, url: '/student' }).catch(() => {});
  } catch (err) {
    console.error('Student grade notification error:', err.message);
  }
}

// Send notification to a specific student only
async function notifyStudent(studentId, title, body) {
  try {
    await pool.query(
      `INSERT INTO notifications (title, body, student_id) VALUES ($1, $2, $3)`,
      [title, body, studentId]
    );
    pushToUser('student', studentId, { title, body, url: '/student' }).catch(() => {});
  } catch (err) {
    console.error('Student notification error:', err.message);
  }
}

module.exports = { notifyGrade, notifyStudent };
