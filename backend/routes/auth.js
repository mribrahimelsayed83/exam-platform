const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');
const notify  = require('../utils/teacherNotif');
const { sendPasswordReset } = require('../utils/sendEmail');

const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });

// ── Student Register ───────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { first_name, last_name, username, password, grade, phone, parent_phone, email } = req.body;

  if (!first_name || !last_name || !username || !password || !grade || !phone || !parent_phone || !email)
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });

  const phoneRegex = /^01[0-9]{9}$/;
  if (!phoneRegex.test(phone))
    return res.status(400).json({ message: 'رقم تليفون الطالب غلط — 11 رقم يبدأ بـ 01' });
  if (!phoneRegex.test(parent_phone))
    return res.status(400).json({ message: 'رقم تليفون ولي الأمر غلط — 11 رقم يبدأ بـ 01' });
  if (![4,5,6,7,8,9,10,11,12].includes(Number(grade)))
    return res.status(400).json({ message: 'الصف الدراسي غير صحيح' });
  if (password.length < 6)
    return res.status(400).json({ message: 'كلمة المرور 6 حروف على الأقل' });
  if (/\s/.test(username))
    return res.status(400).json({ message: 'اسم المستخدم بدون مسافات' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });

  try {
    const dupUser  = await pool.query('SELECT id FROM students WHERE username=$1', [username.toLowerCase()]);
    if (dupUser.rows.length) return res.status(409).json({ message: 'اسم المستخدم مستخدم بالفعل' });

    const dupEmail = await pool.query('SELECT id FROM students WHERE email=$1', [email.toLowerCase()]);
    if (dupEmail.rows.length) return res.status(409).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });

    const hashed  = await bcrypt.hash(password, 10);
    const fullName = `${first_name.trim()} ${last_name.trim()}`;

    const inserted = await pool.query(
      `INSERT INTO students
         (first_name, last_name, name, username, password, grade, phone, parent_phone, email, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING id`,
      [first_name.trim(), last_name.trim(), fullName,
       username.toLowerCase(), hashed, Number(grade), phone, parent_phone, email.toLowerCase()]
    );

    notify('register', '📝 طلب تسجيل جديد',
      `${fullName} طلب إنشاء حساب — الصف: ${grade} — تليفون: ${phone}`,
      'student', inserted.rows[0].id
    );

    res.status(201).json({ message: 'تم إرسال طلب التسجيل — في انتظار موافقة المدرس' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Student Login ──────────────────────────────────────────────────────────
router.post('/student/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'يرجى ملء جميع الحقول' });
  try {
    const result  = await pool.query('SELECT * FROM students WHERE username=$1', [username.trim().toLowerCase()]);
    const student = result.rows[0];
    if (!student) return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غلط' });
    if (student.status === 'pending')
      return res.status(403).json({ message: 'حسابك في انتظار موافقة المدرس' });
    if (student.status === 'rejected')
      return res.status(403).json({ message: 'تم رفض طلب تسجيلك — تواصل مع المدرس' });
    const valid = await bcrypt.compare(password, student.password);
    if (!valid) return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غلط' });

    notify('login', '🔑 تسجيل دخول طالب',
      `${student.name} سجّل دخوله للمنصة`, 'student', student.id);

    const token = sign({ id: student.id, role: 'student', grade: student.grade, name: student.name });
    res.json({
      token,
      user: { id: student.id, name: student.name, username: student.username,
              grade: student.grade, role: 'student' },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Teacher Login ──────────────────────────────────────────────────────────
router.post('/teacher/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'يرجى ملء جميع الحقول' });
  try {
    const result  = await pool.query('SELECT * FROM teachers WHERE username=$1', [username.trim().toLowerCase()]);
    const teacher = result.rows[0];
    if (!teacher) return res.status(401).json({ message: 'بيانات الدخول غلط' });
    const valid = await bcrypt.compare(password, teacher.password);
    if (!valid) return res.status(401).json({ message: 'بيانات الدخول غلط' });
    const token = sign({ id: teacher.id, role: 'teacher', name: teacher.name });
    res.json({ token, user: { id: teacher.id, name: teacher.name, username: teacher.username, role: 'teacher' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Assistant Login ────────────────────────────────────────────────────────
router.post('/assistant/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'يرجى ملء جميع الحقول' });
  try {
    const result = await pool.query('SELECT * FROM assistants WHERE username=$1', [username.trim().toLowerCase()]);
    const asst   = result.rows[0];
    if (!asst) return res.status(401).json({ message: 'بيانات الدخول غلط' });
    const valid = await bcrypt.compare(password, asst.password);
    if (!valid) return res.status(401).json({ message: 'بيانات الدخول غلط' });
    const token = sign({ id: asst.id, role: 'assistant', name: asst.name });
    res.json({ token, user: { id: asst.id, name: asst.name, username: asst.username, role: 'assistant' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Me ─────────────────────────────────────────────────────────────────────
router.get('/me', auth(), async (req, res) => {
  try {
    const { id, role } = req.user;
    let result;
    if (role === 'teacher')
      result = await pool.query('SELECT id,name,username,subject,platform_name FROM teachers WHERE id=$1', [id]);
    else if (role === 'assistant')
      result = await pool.query('SELECT id,name,username FROM assistants WHERE id=$1', [id]);
    else
      result = await pool.query('SELECT id,name,username,grade,email,phone,created_at FROM students WHERE id=$1', [id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'المستخدم مش موجود' });
    res.json({ ...result.rows[0], role });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Forgot Password ────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email)
    return res.status(400).json({ message: 'اسم المستخدم والبريد الإلكتروني مطلوبان' });

  try {
    // Find by username first
    const byUsername = await pool.query(
      'SELECT * FROM students WHERE username=$1', [username.toLowerCase()]
    );
    if (!byUsername.rows[0])
      return res.status(404).json({ message: 'اسم المستخدم غير موجود' });

    const student = byUsername.rows[0];

    // Check email matches
    if (student.email?.toLowerCase() !== email.toLowerCase())
      return res.status(400).json({ message: 'البريد الإلكتروني لا يطابق هذا الحساب' });

    // Generate token
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      'UPDATE students SET reset_token=$1, reset_token_exp=$2 WHERE id=$3',
      [token, expires, student.id]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const sent = await sendPasswordReset(student.email, student.name, resetLink);

    if (!sent)
      return res.status(500).json({ message: 'فشل إرسال الإيميل — حاول مرة أخرى' });

    res.json({ message: 'تم إرسال رابط إعادة التعيين على بريدك الإلكتروني' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Change Password (logged-in student) ───────────────────────────────────
router.post('/change-password', auth('student'), async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  if (newPassword.length < 6)
    return res.status(400).json({ message: 'كلمة المرور الجديدة 6 حروف على الأقل' });

  try {
    const result = await pool.query('SELECT password FROM students WHERE id=$1', [req.user.id]);
    const student = result.rows[0];
    if (!student) return res.status(404).json({ message: 'الحساب غير موجود' });

    const valid = await bcrypt.compare(oldPassword, student.password);
    if (!valid) return res.status(400).json({ message: 'كلمة المرور القديمة غلط' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE students SET password=$1 WHERE id=$2', [hashed, req.user.id]);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── Reset Password ─────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ message: 'البيانات ناقصة' });
  if (password.length < 6)
    return res.status(400).json({ message: 'كلمة المرور 6 حروف على الأقل' });

  try {
    const result = await pool.query(
      `SELECT * FROM students
       WHERE reset_token=$1 AND reset_token_exp > NOW()`,
      [token]
    );
    const student = result.rows[0];
    if (!student)
      return res.status(400).json({ message: 'الرابط غير صالح أو منتهي الصلاحية' });

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE students SET password=$1, reset_token=NULL, reset_token_exp=NULL WHERE id=$2',
      [hashed, student.id]
    );

    res.json({ message: '✅ تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
