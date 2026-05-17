const walletModel = require('../models/walletModel');
const { ValidationError, NotFoundError, ConflictError } = require('../errors');

const MAX_NAME = 80;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

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

const validatePayload = ({ name, color, initial_balance }) => {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('Wallet name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME) {
    throw new ValidationError(`Name must be at most ${MAX_NAME} characters`);
  }
  let cleanColor = '#3a3733';
  if (color !== undefined && color !== null && color !== '') {
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
      throw new ValidationError('Color must be a hex value like #aabbcc');
    }
    cleanColor = color;
  }
  let balance = 0;
  if (initial_balance !== undefined && initial_balance !== null && initial_balance !== '') {
    const n = Number(initial_balance);
    if (!Number.isFinite(n)) throw new ValidationError('Initial balance must be a number');
    balance = n;
  }
  return { name: trimmed, color: cleanColor, initial_balance: balance };
};

const getAllWallets = async (userId) => {
  const uid = validateUserId(userId);
  return walletModel.getAll(uid);
};

const getWalletById = async (id, userId) => {
  const uid = validateUserId(userId);
  const wid = validateId(id);
  const w = await walletModel.getById(wid, uid);
  if (!w) throw new NotFoundError('Wallet not found');
  return w;
};

const createWallet = async (userId, raw) => {
  const uid = validateUserId(userId);
  const clean = validatePayload(raw);
  try {
    return await walletModel.create(uid, clean);
  } catch (err) {
    if (err.code === '23505') throw new ConflictError('Wallet name already exists');
    throw err;
  }
};

const updateWallet = async (id, userId, raw) => {
  const uid = validateUserId(userId);
  const wid = validateId(id);
  await getWalletById(wid, uid);
  const clean = validatePayload(raw);
  try {
    return await walletModel.update(wid, uid, clean);
  } catch (err) {
    if (err.code === '23505') throw new ConflictError('Wallet name already exists');
    throw err;
  }
};

const deleteWallet = async (id, userId) => {
  const uid = validateUserId(userId);
  const wid = validateId(id);
  await getWalletById(wid, uid);
  await walletModel.remove(wid, uid);
};

const getWalletBalances = async (userId) => {
  const uid = validateUserId(userId);
  const rows = await walletModel.getBalances(uid);
  return rows.map((r) => {
    const initial = Number(r.initial_balance) || 0;
    const income  = Number(r.income)  || 0;
    const expense = Number(r.expense) || 0;
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      initial_balance: initial,
      income,
      expense,
      balance: initial + income - expense,
    };
  });
};

module.exports = {
  getAllWallets,
  getWalletById,
  createWallet,
  updateWallet,
  deleteWallet,
  getWalletBalances,
  _internals: { validatePayload },
};
