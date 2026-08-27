const jwt  = require('jsonwebtoken');
const pool = require('../db/pool');

function authMiddleware(role) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ message: 'غير مصرح — لازم تسجل دخول' });

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      // A pending-2FA token (issued after password-only, before the TOTP
      // code) must never work as a real session token anywhere — only
      // POST /auth/teacher/login/2fa may consume it. Without this check,
      // anyone who obtains just the password could skip 2FA entirely by
      // using the temp token directly on any teacher-only route.
      if (decoded.pending2FA)
        return res.status(401).json({ message: 'يجب إكمال التحقق بخطوتين أولاً' });
      // role يمكن يكون string واحد أو array
      if (role) {
        const allowed = Array.isArray(role) ? role : [role];
        if (!allowed.includes(decoded.role))
          return res.status(403).json({ message: 'ممنوع — صلاحيات غير كافية' });
      }
      // تحقق إن الطالب لسه approved في الـ DB (مش بس في التوكن)
      if (decoded.role === 'student') {
        const { rows } = await pool.query(
          'SELECT status FROM students WHERE id=$1', [decoded.id]
        );
        if (!rows[0] || rows[0].status !== 'approved')
          return res.status(403).json({ message: 'حسابك موقوف أو غير مفعّل — تواصل مع المدرس' });
      }
      req.user = decoded;
      next();
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')
        return res.status(401).json({ message: 'Token غير صالح أو منتهي الصلاحية' });
      return res.status(500).json({ message: 'خطأ في السيرفر' });
    }
  };
}

// helper: المدرس أو المساعد
authMiddleware.staff = authMiddleware(['teacher', 'assistant']);

// helper: يتحقق إن المساعد عنده صلاحية معينة (المدرّس دايمًا عنده كل الصلاحيات).
// بيقرا من الداتابيز مباشرة (مش من الـ JWT) عشان أي تعديل صلاحيات من المدرّس
// يتفعّل فورًا من غير ما المساعد يحتاج يعمل تسجيل خروج ودخول تاني.
authMiddleware.permission = (key) => async (req, res, next) => {
  if (req.user.role === 'teacher') return next();
  try {
    const { rows } = await pool.query('SELECT permissions FROM assistants WHERE id=$1', [req.user.id]);
    const perms = JSON.parse(rows[0]?.permissions || '[]');
    if (perms.includes(key)) return next();
    return res.status(403).json({ message: 'ممنوع — لا تملك صلاحية الوصول لهذا القسم' });
  } catch {
    return res.status(403).json({ message: 'ممنوع' });
  }
};

module.exports = authMiddleware;
