const express = require('express');
const service = require('../services/categoryService');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await service.getAllCategories(req.user.id));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await service.getCategoryById(req.params.id, req.user.id));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, color } = req.body || {};
  const created = await service.createCategory(req.user.id, name, color);
  res.status(201).json(created);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { name, color } = req.body || {};
  res.json(await service.updateCategory(req.params.id, req.user.id, name, color));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await service.deleteCategory(req.params.id, req.user.id);
  res.status(204).send();
}));

module.exports = router;
