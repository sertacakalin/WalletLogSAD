const express = require('express');
const service = require('../services/walletService');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/balances', asyncHandler(async (req, res) => {
  res.json(await service.getWalletBalances(req.user.id));
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await service.getAllWallets(req.user.id));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await service.getWalletById(req.params.id, req.user.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  const created = await service.createWallet(req.user.id, req.body || {});
  res.status(201).json(created);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const updated = await service.updateWallet(req.params.id, req.user.id, req.body || {});
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await service.deleteWallet(req.params.id, req.user.id);
  res.status(204).send();
}));

module.exports = router;
