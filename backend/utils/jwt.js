const jwt = require('jsonwebtoken');

const ISS = 'walletlog';
const AUD = 'walletlog-api';

const accessSecret = () => {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_ACCESS_SECRET is missing or too short (min 16 chars)');
  }
  return s;
};

const accessTtl = () => process.env.ACCESS_TOKEN_TTL || '15m';

const signAccessToken = (user) => {
  return jwt.sign(
    { sub: user.id, email: user.email },
    accessSecret(),
    { algorithm: 'HS256', expiresIn: accessTtl(), issuer: ISS, audience: AUD }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, accessSecret(), {
    algorithms: ['HS256'],
    issuer: ISS,
    audience: AUD,
  });
};

module.exports = { signAccessToken, verifyAccessToken };
