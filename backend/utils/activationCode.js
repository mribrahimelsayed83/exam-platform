// Short, dictation-friendly codes — uppercase, no ambiguous chars (0/O, 1/I/L).
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateActivationCode(len = 8) {
  let code = '';
  for (let i = 0; i < len; i++) code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  return code;
}

// Generates a code guaranteed unique against the students table.
async function generateUniqueActivationCode(pool) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateActivationCode();
    const { rows } = await pool.query('SELECT 1 FROM students WHERE activation_code=$1', [code]);
    if (!rows.length) return code;
  }
  throw new Error('تعذر توليد كود فريد — حاول مرة أخرى');
}

module.exports = { generateActivationCode, generateUniqueActivationCode };
