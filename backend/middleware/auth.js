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

module.exports = authMiddleware;
