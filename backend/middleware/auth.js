const jwt = require('jsonwebtoken');

function authMiddleware(role) {
  return (req, res, next) => {
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
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ message: 'Token غير صالح أو منتهي الصلاحية' });
    }
  };
}

// helper: المدرس أو المساعد
authMiddleware.staff = authMiddleware(['teacher', 'assistant']);

module.exports = authMiddleware;
