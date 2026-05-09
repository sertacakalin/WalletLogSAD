const express = require('express');
const service = require('../services/transactionService');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/summary', asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  res.json(await service.getMonthlySummary(req.user.id, month, year));
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await service.getAllTransactions(req.user.id, req.query));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await service.getTransactionById(req.params.id, req.user.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  const created = await service.createTransaction(req.user.id, req.body || {});
  res.status(201).json(created);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const updated = await service.updateTransaction(req.params.id, req.user.id, req.body || {});
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await service.deleteTransaction(req.params.id, req.user.id);
  res.status(204).send();
}));

module.exports = router;
