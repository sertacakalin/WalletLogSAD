const { AppError } = require('../errors');

const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err && err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  if (err && err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource does not exist' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
