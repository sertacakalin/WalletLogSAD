const crypto = require('crypto');

const REFRESH_TTL_DAYS_DEFAULT = 7;

const refreshTtlDays = () => {
  const n = Number(process.env.REFRESH_TOKEN_TTL_DAYS);
  if (Number.isInteger(n) && n >= 1 && n <= 90) return n;
  return REFRESH_TTL_DAYS_DEFAULT;
};

const generateRefreshToken = () => crypto.randomBytes(32).toString('base64url');

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const refreshExpiry = () => {
  const ms = refreshTtlDays() * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
};

module.exports = {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
  refreshTtlDays,
};
