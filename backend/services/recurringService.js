const recurringModel = require('../models/recurringModel');
const { ValidationError, NotFoundError } = require('../errors');
const { isValidISODate, advanceDate } = require('../utils/dates');

const VALID_TYPES = ['income', 'expense'];
const VALID_FREQ  = ['weekly', 'monthly', 'yearly'];
const MAX_TITLE   = 200;

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

const validatePayload = ({
  title, amount, type, frequency, next_due_date,
  category_id, wallet_id, note, is_active,
}) => {
  if (typeof title !== 'string' || title.trim() === '') {
    throw new ValidationError('Title is required');
  }
  if (title.trim().length > MAX_TITLE) {
    throw new ValidationError(`Title must be at most ${MAX_TITLE} characters`);
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ValidationError('Amount must be greater than zero');
  }
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError('Type must be income or expense');
  }
  if (!VALID_FREQ.includes(frequency)) {
    throw new ValidationError('Frequency must be weekly, monthly, or yearly');
  }
  if (!isValidISODate(next_due_date)) {
    throw new ValidationError('Next due date must be a valid YYYY-MM-DD value');
  }
  return {
    title: title.trim(),
    amount: numericAmount,
    type,
    frequency,
    next_due_date,
    category_id: validateOptionalFk(category_id, 'category_id'),
    wallet_id:   validateOptionalFk(wallet_id, 'wallet_id'),
    note: typeof note === 'string' ? note.trim() : null,
    is_active: is_active === undefined ? true : Boolean(is_active),
  };
};

const getAllRecurring = async (userId) => {
  const uid = validateUserId(userId);
  return recurringModel.getAll(uid);
};

const getRecurringById = async (id, userId) => {
  const uid = validateUserId(userId);
  const rid = validateId(id);
  const r = await recurringModel.getById(rid, uid);
  if (!r) throw new NotFoundError('Recurring transaction not found');
  return r;
};

const getUpcoming = async (userId, limit) => {
  const uid = validateUserId(userId);
  const lim = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 5;
  return recurringModel.getUpcoming(uid, lim);
};

const createRecurring = async (userId, raw) => {
  const uid = validateUserId(userId);
  const clean = validatePayload(raw);
  return recurringModel.create(uid, clean);
};

const updateRecurring = async (id, userId, raw) => {
  const uid = validateUserId(userId);
  const rid = validateId(id);
  await getRecurringById(rid, uid);
  const clean = validatePayload(raw);
  return recurringModel.update(rid, uid, clean);
};

const deleteRecurring = async (id, userId) => {
  const uid = validateUserId(userId);
  const rid = validateId(id);
  await getRecurringById(rid, uid);
  await recurringModel.remove(rid, uid);
};

// Advance the next_due_date to the next occurrence in the future.
// Useful after the user marks a recurring tx as paid (out of scope of UI for now,
// but exposed for completeness and tests).
const rollNextDueDate = async (id, userId) => {
  const r = await getRecurringById(id, userId);
  const next = advanceDate(toISO(r.next_due_date), r.frequency);
  return recurringModel.update(id, userId, {
    ...r,
    next_due_date: next,
  });
};

const toISO = (d) => {
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d;
};

module.exports = {
  getAllRecurring,
  getRecurringById,
  getUpcoming,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  rollNextDueDate,
  _internals: { validatePayload, toISO },
};
