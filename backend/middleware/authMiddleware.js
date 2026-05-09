const { verifyAccessToken } = require('../utils/jwt');
const { UnauthorizedError } = require('../errors');

const requireAuth = (req, _res, next) => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Authentication required'));
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) return next(new UnauthorizedError('Authentication required'));

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: Number(payload.sub), email: payload.email };
    return next();
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token expired'));
    }
    return next(new UnauthorizedError('Access token invalid'));
  }
};

module.exports = { requireAuth };
