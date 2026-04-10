const pool = require('../db/pool');

async function notify(type, title, body, linkType = null, linkId = null) {
  try {
    await pool.query(
      `INSERT INTO teacher_notifications (type, title, body, link_type, link_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [type, title, body, linkType, linkId]
    );
  } catch (err) {
    console.error('Teacher notification error:', err.message);
  }
}

module.exports = notify;
