require('dotenv').config();
const pool = require('./pool');
const bcrypt = require('bcryptjs');
const fs = require('fs');

async function seed() {
  const client = await pool.connect();
  try {
    const schema = fs.readFileSync(__dirname + '/schema.sql', 'utf8');
    await client.query(schema);
    console.log('✅ Tables created');

    const existing = await client.query('SELECT id FROM teachers WHERE username = $1', [
      process.env.TEACHER_USERNAME || 'teacher',
    ]);
    if (existing.rows.length > 0) {
      console.log('ℹ️  Teacher already exists — skipping');
      return;
    }

    const hashed = await bcrypt.hash(process.env.TEACHER_PASSWORD || 'teacher123', 10);
    await client.query(
      'INSERT INTO teachers (username, password, name) VALUES ($1, $2, $3)',
      [process.env.TEACHER_USERNAME || 'teacher', hashed, process.env.TEACHER_NAME || 'المدرس']
    );
    console.log('✅ Default teacher created');
    console.log(`   Username: ${process.env.TEACHER_USERNAME || 'teacher'}`);
    console.log(`   Password: ${process.env.TEACHER_PASSWORD || 'teacher123'}`);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
