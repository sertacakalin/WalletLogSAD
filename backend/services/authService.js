const userModel = require('../models/userModel');
const refreshTokenModel = require('../models/refreshTokenModel');
const password = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
} = require('../utils/tokens');
const { ValidationError, ConflictError, UnauthorizedError } = require('../errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email) => {
  if (typeof email !== 'string') throw new ValidationError('Email is required');
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0)        throw new ValidationError('Email is required');
  if (trimmed.length > 254)        throw new ValidationError('Email is too long');
  if (!EMAIL_RE.test(trimmed))     throw new ValidationError('Email format is invalid');
  return trimmed;
};

const validatePassword = (pw) => {
  if (typeof pw !== 'string')      throw new ValidationError('Password is required');
  if (pw.length < 8)               throw new ValidationError('Password must be at least 8 characters');
  if (pw.length > 72)              throw new ValidationError('Password must be at most 72 characters');
  if (!/[A-Za-z]/.test(pw))        throw new ValidationError('Password must include a letter');
  if (!/\d/.test(pw))              throw new ValidationError('Password must include a digit');
  return pw;
};

const validateDisplayName = (name) => {
  if (name === undefined || name === null || name === '') return null;
  if (typeof name !== 'string') throw new ValidationError('Display name must be a string');
  const trimmed = name.trim();
  if (trimmed.length === 0)  return null;
  if (trimmed.length > 80)   throw new ValidationError('Display name must be at most 80 characters');
  return trimmed;
};

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  display_name: u.display_name || null,
});

const issueRefreshToken = async ({ userId, userAgent, ip }) => {
  const raw = generateRefreshToken();
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = refreshExpiry();
  const row = await refreshTokenModel.create({
    userId, tokenHash, expiresAt, userAgent, ip,
  });
  return { raw, row };
};

const register = async ({ email, password: pw, displayName, userAgent, ip }) => {
  const cleanEmail = validateEmail(email);
  validatePassword(pw);
  const cleanDisplayName = validateDisplayName(displayName);

  if (await userModel.existsByEmail(cleanEmail)) {
    throw new ConflictError('Email is already registered');
  }

  const passwordHash = await password.hash(pw);
  const user = await userModel.create({
    email: cleanEmail,
    passwordHash,
    displayName: cleanDisplayName,
  });

  const accessToken = signAccessToken(user);
  const { raw: refreshToken } = await issueRefreshToken({
    userId: user.id, userAgent, ip,
  });

  return { user: publicUser(user), accessToken, refreshToken };
};

const login = async ({ email, password: pw, userAgent, ip }) => {
  if (typeof email !== 'string' || typeof pw !== 'string') {
    throw new UnauthorizedError();
  }

  const user = await userModel.findByEmail(email.trim());
  if (!user) throw new UnauthorizedError();

  const ok = await password.compare(pw, user.password_hash);
  if (!ok) throw new UnauthorizedError();

  const accessToken = signAccessToken(user);
  const { raw: refreshToken } = await issueRefreshToken({
    userId: user.id, userAgent, ip,
  });

  return { user: publicUser(user), accessToken, refreshToken };
};

const refresh = async ({ refreshToken, userAgent, ip }) => {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new UnauthorizedError('Refresh token missing');
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await refreshTokenModel.findByHash(tokenHash);
  if (!stored) throw new UnauthorizedError('Refresh token invalid');

  if (stored.revoked_at) {
    // Reuse detection: revoke entire family for this user.
    await refreshTokenModel.revokeAllForUser(stored.user_id);
    throw new UnauthorizedError('Refresh token reuse detected');
  }

  if (new Date(stored.expires_at).getTime() <= Date.now()) {
    await refreshTokenModel.revoke(stored.id);
    throw new UnauthorizedError('Refresh token expired');
  }

  const user = await userModel.findById(stored.user_id);
  if (!user) {
    await refreshTokenModel.revoke(stored.id);
    throw new UnauthorizedError('Refresh token invalid');
  }

  const next = await issueRefreshToken({ userId: user.id, userAgent, ip });
  await refreshTokenModel.revoke(stored.id, next.row.id);

  const accessToken = signAccessToken(user);
  return { user: publicUser(user), accessToken, refreshToken: next.raw };
};

const logout = async ({ refreshToken }) => {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) return;
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await refreshTokenModel.findByHash(tokenHash);
  if (!stored || stored.revoked_at) return;
  await refreshTokenModel.revoke(stored.id);
};

const me = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user) throw new UnauthorizedError();
  return publicUser(user);
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  // exposed for tests
  _internals: { validateEmail, validatePassword, validateDisplayName, publicUser },
};
