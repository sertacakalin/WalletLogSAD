const express = require('express');
const service = require('../services/budgetService');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/status', asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  res.json(await service.getBudgetStatus(req.user.id, month, year));
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await service.getAllBudgets(req.user.id));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await service.getBudgetById(req.params.id, req.user.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  const created = await service.createBudget(req.user.id, req.body || {});
  res.status(201).json(created);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  res.json(await service.updateBudget(req.params.id, req.user.id, req.body || {}));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await service.deleteBudget(req.params.id, req.user.id);
  res.status(204).send();
}));

module.exports = router;
