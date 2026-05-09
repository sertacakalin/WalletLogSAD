const categoryModel = require('../models/categoryModel');
const { ValidationError, NotFoundError } = require('../errors');

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_COLOR = '#cccccc';

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

const validatePayload = ({ name, color }) => {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new ValidationError('Category name is required');
  }
  if (name.trim().length > 100) {
    throw new ValidationError('Category name must be at most 100 characters');
  }
  const finalColor = color && HEX_COLOR.test(color) ? color : DEFAULT_COLOR;
  return { name: name.trim(), color: finalColor };
};

const getAllCategories = async (userId) => {
  const uid = validateUserId(userId);
  return categoryModel.getAll(uid);
};

const getCategoryById = async (id, userId) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  const category = await categoryModel.getById(numericId, uid);
  if (!category) throw new NotFoundError('Category not found');
  return category;
};

const createCategory = async (userId, name, color) => {
  const uid = validateUserId(userId);
  const clean = validatePayload({ name, color });
  return categoryModel.create(uid, clean.name, clean.color);
};

const updateCategory = async (id, userId, name, color) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  const clean = validatePayload({ name, color });
  await getCategoryById(numericId, uid);
  return categoryModel.update(numericId, uid, clean.name, clean.color);
};

const deleteCategory = async (id, userId) => {
  const uid = validateUserId(userId);
  const numericId = validateId(id);
  await getCategoryById(numericId, uid);
  await categoryModel.remove(numericId, uid);
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
