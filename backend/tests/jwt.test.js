process.env.JWT_ACCESS_SECRET = 'test-secret-must-be-long-enough-12345';

const { signAccessToken, verifyAccessToken } = require('../utils/jwt');

describe('utils/jwt', () => {
  test('round-trip preserves sub, email, iss, aud', () => {
    const token = signAccessToken({ id: 42, email: 'a@b.com' });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(42);
    expect(decoded.email).toBe('a@b.com');
    expect(decoded.iss).toBe('walletlog');
    expect(decoded.aud).toBe('walletlog-api');
  });

  test('tampered token throws', () => {
    const token = signAccessToken({ id: 1, email: 'a@b.com' });
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA');
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  test('wrong audience is rejected', () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign(
      { sub: 1, email: 'x@y.com' },
      process.env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '15m', issuer: 'walletlog', audience: 'someone-else' }
    );
    expect(() => verifyAccessToken(bad)).toThrow();
  });

  test('expired token throws TokenExpiredError', () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign(
      { sub: 1, email: 'x@y.com' },
      process.env.JWT_ACCESS_SECRET,
      { algorithm: 'HS256', expiresIn: '-1s', issuer: 'walletlog', audience: 'walletlog-api' }
    );
    expect(() => verifyAccessToken(expired)).toThrow(/jwt expired|expired/i);
  });

  test('missing secret causes signing to throw', () => {
    const original = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = '';
    expect(() => signAccessToken({ id: 1, email: 'x@y.com' })).toThrow(/JWT_ACCESS_SECRET/);
    process.env.JWT_ACCESS_SECRET = original;
  });
});
