const express = require('express');
const service = require('../services/recurringService');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/upcoming', asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 5;
  res.json(await service.getUpcoming(req.user.id, limit));
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await service.getAllRecurring(req.user.id));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await service.getRecurringById(req.params.id, req.user.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  const created = await service.createRecurring(req.user.id, req.body || {});
  res.status(201).json(created);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const updated = await service.updateRecurring(req.params.id, req.user.id, req.body || {});
  res.json(updated);
}));

router.post('/:id/roll', asyncHandler(async (req, res) => {
  const rolled = await service.rollNextDueDate(req.params.id, req.user.id);
  res.json(rolled);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await service.deleteRecurring(req.params.id, req.user.id);
  res.status(204).send();
}));

module.exports = router;
