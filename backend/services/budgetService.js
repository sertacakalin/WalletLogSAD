const budgetModel = require('../models/budgetModel');
const transactionModel = require('../models/transactionModel');
const categoryModel = require('../models/categoryModel');
const { ValidationError, NotFoundError } = require('../errors');
const { monthRange, isValidMonth, isValidYear } = require('../utils/dates');

const validateId = (id) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError('Invalid ID');
  return n;
};

const validateUserId = (userId) => {
  const n = Number(userId);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError('Invalid user');
  return n;
};

const validateCreatePayload = ({ category_id, month, year, limit_amount }) => {
  const cid = Number(category_id);
  if (!Number.isInteger(cid) || cid <= 0) {
    throw new ValidationError('category_id is required');
  }
  const m = Number(month);
  const y = Number(year);
  if (!isValidMonth(m)) throw new ValidationError('Invalid month (must be 1-12)');
  if (!isValidYear(y))  throw new ValidationError('Invalid year');

  const limit = Number(limit_amount);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new ValidationError('Limit must be greater than zero');
  }
  return { category_id: cid, month: m, year: y, limit_amount: limit };
};

const validateUpdatePayload = ({ limit_amount }) => {
  const limit = Number(limit_amount);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new ValidationError('Limit must be greater than zero');
  }
  return { limit_amount: limit };
};

const getAllBudgets = async (userId) => {
  const uid = validateUserId(userId);
  return budgetModel.getAll(uid);
};

const getBudgetById = async (id, userId) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  const b = await budgetModel.getById(numericId, uid);
  if (!b) throw new NotFoundError('Budget not found');
  return b;
};

const createBudget = async (userId, raw) => {
  const uid = validateUserId(userId);
  const clean = validateCreatePayload(raw);
  // Block budgets that reference another user's category — would leak the
  // foreign category name through the JOIN in budgetModel.getAll.
  const owned = await categoryModel.getById(clean.category_id, uid);
  if (!owned) throw new ValidationError('Invalid category_id');
  return budgetModel.create(uid, clean);
};

const updateBudget = async (id, userId, raw) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  const clean = validateUpdatePayload(raw);
  await getBudgetById(numericId, uid);
  return budgetModel.update(numericId, uid, clean);
};

const deleteBudget = async (id, userId) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  await getBudgetById(numericId, uid);
  await budgetModel.remove(numericId, uid);
};

const getBudgetStatus = async (userId, month, year) => {
  const uid = validateUserId(userId);
  let range;
  try {
    range = monthRange(month, year);
  } catch (e) {
    throw new ValidationError(e.message);
  }
  const m = Number(month);
  const y = Number(year);
  const budgets = await budgetModel.getAll(uid);
  const filtered = budgets.filter((b) => b.month === m && b.year === y);

  return Promise.all(filtered.map(async (b) => {
    const txns = await transactionModel.getAll(uid, {
      category_id: b.category_id,
      type: 'expense',
      startDate: range.startDate,
      endDate: range.endDate,
    });
    const spent = txns.reduce((s, t) => s + Number(t.amount), 0);
    const limit = Number(b.limit_amount);
    const remaining = limit - spent;
    return {
      budget_id: b.id,
      category_id: b.category_id,
      category: b.category_name,
      limit,
      spent,
      remaining,
      exceeded: remaining < 0,
    };
  }));
};

module.exports = {
  getAllBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetStatus,
};
