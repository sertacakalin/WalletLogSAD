const transactionModel = require('../models/transactionModel');
const categoryModel    = require('../models/categoryModel');
const walletModel      = require('../models/walletModel');
const { ValidationError, NotFoundError } = require('../errors');
const { monthRange, isValidISODate } = require('../utils/dates');

const VALID_TYPES = ['income', 'expense'];
const MAX_TITLE = 200;

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

const validateOptionalFk = (value, label) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`Invalid ${label}`);
  return n;
};

const validatePayload = ({ title, amount, type, date, category_id, wallet_id, note }) => {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new ValidationError('Title is required');
  }
  if (title.trim().length > MAX_TITLE) {
    throw new ValidationError(`Title must be at most ${MAX_TITLE} characters`);
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ValidationError('Enter a valid amount greater than zero');
  }
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError('Type must be income or expense');
  }
  if (!isValidISODate(date)) {
    throw new ValidationError('Date must be a valid YYYY-MM-DD value');
  }
  const cleanNote = typeof note === 'string' ? note.trim() : null;

  return {
    title: title.trim(),
    amount: numericAmount,
    type,
    date,
    category_id: validateOptionalFk(category_id, 'category_id'),
    wallet_id:   validateOptionalFk(wallet_id, 'wallet_id'),
    note: cleanNote,
  };
};

const buildFilters = (raw = {}) => {
  const filters = {};
  if (raw.type) {
    if (!VALID_TYPES.includes(raw.type)) throw new ValidationError('Invalid type filter');
    filters.type = raw.type;
  }
  if (raw.category_id) {
    const cid = Number(raw.category_id);
    if (!Number.isInteger(cid) || cid <= 0) throw new ValidationError('Invalid category_id filter');
    filters.category_id = cid;
  }
  if (raw.wallet_id) {
    const wid = Number(raw.wallet_id);
    if (!Number.isInteger(wid) || wid <= 0) throw new ValidationError('Invalid wallet_id filter');
    filters.wallet_id = wid;
  }
  if (raw.startDate) {
    if (!isValidISODate(raw.startDate)) throw new ValidationError('Invalid startDate');
    filters.startDate = raw.startDate;
  }
  if (raw.endDate) {
    if (!isValidISODate(raw.endDate)) throw new ValidationError('Invalid endDate');
    filters.endDate = raw.endDate;
  }
  return filters;
};

// Verifies that a referenced category/wallet (if any) belongs to the same user.
// Without this, a user can attach their record to another user's category_id
// (FK only checks existence, not ownership) — leaks the other user's name on JOIN.
const assertFkOwnership = async (uid, { category_id, wallet_id }) => {
  if (category_id !== null && category_id !== undefined) {
    const owned = await categoryModel.getById(category_id, uid);
    if (!owned) throw new ValidationError('Invalid category_id');
  }
  if (wallet_id !== null && wallet_id !== undefined) {
    const owned = await walletModel.getById(wallet_id, uid);
    if (!owned) throw new ValidationError('Invalid wallet_id');
  }
};

const getAllTransactions = async (userId, rawFilters) => {
  const uid = validateUserId(userId);
  const filters = buildFilters(rawFilters);
  return transactionModel.getAll(uid, filters);
};

const getTransactionById = async (id, userId) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  const t = await transactionModel.getById(numericId, uid);
  if (!t) throw new NotFoundError('Transaction not found');
  return t;
};

const createTransaction = async (userId, data) => {
  const uid = validateUserId(userId);
  const clean = validatePayload(data);
  await assertFkOwnership(uid, clean);
  return transactionModel.create(uid, clean);
};

const updateTransaction = async (id, userId, data) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  const clean = validatePayload(data);
  await getTransactionById(numericId, uid);
  await assertFkOwnership(uid, clean);
  return transactionModel.update(numericId, uid, clean);
};

const deleteTransaction = async (id, userId) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  await getTransactionById(numericId, uid);
  await transactionModel.remove(numericId, uid);
};

const getMonthlySummary = async (userId, month, year) => {
  const uid = validateUserId(userId);
  let range;
  try {
    range = monthRange(month, year);
  } catch (e) {
    throw new ValidationError(e.message);
  }
  const txns = await transactionModel.getAll(uid, range);
  const income = txns
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expense = txns
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  return { income, expense, balance: income - expense };
};

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthlySummary,
};
