const express = require('express');
const service = require('../services/dashboardService');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  res.json(await service.getDashboard(req.user.id, month, year));
}));

module.exports = router;
