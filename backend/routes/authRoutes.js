const express = require('express');
const service = require('../services/authService');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/authMiddleware');
const { refreshTtlDays } = require('../utils/tokens');

const router = express.Router();

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: refreshTtlDays() * 24 * 60 * 60 * 1000,
});

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, cookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: 0 });
};

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, displayName } = req.body || {};
  const result = await service.register({
    email, password, displayName,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const result = await service.login({
    email, password,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies && req.cookies[REFRESH_COOKIE];
  const result = await service.refresh({
    refreshToken,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setRefreshCookie(res, result.refreshToken);
  res.json({ user: result.user, accessToken: result.accessToken });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies && req.cookies[REFRESH_COOKIE];
  await service.logout({ refreshToken });
  clearRefreshCookie(res);
  res.status(204).send();
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await service.me(req.user.id);
  res.json({ user });
}));

module.exports = router;
