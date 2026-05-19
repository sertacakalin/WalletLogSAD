jest.mock('../models/recurringModel', () => ({
  getAll: jest.fn(),
  getById: jest.fn(),
  getUpcoming: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

jest.mock('../models/categoryModel', () => ({
  getById: jest.fn(),
}));

jest.mock('../models/walletModel', () => ({
  getById: jest.fn(),
}));

const recurringModel = require('../models/recurringModel');
const categoryModel  = require('../models/categoryModel');
const walletModel    = require('../models/walletModel');
const service = require('../services/recurringService');
const { ValidationError, NotFoundError } = require('../errors');

beforeEach(() => {
  // Default: any referenced FK is owned by the current user.
  // Tests that need a foreign FK override with mockResolvedValueOnce(undefined).
  categoryModel.getById.mockResolvedValue({ id: 1, user_id: 1 });
  walletModel.getById.mockResolvedValue({ id: 1, user_id: 1 });
});

afterEach(() => jest.clearAllMocks());

const validPayload = (overrides = {}) => ({
  title: 'Rent',
  amount: 18000,
  type: 'expense',
  frequency: 'monthly',
  next_due_date: '2026-06-01',
  ...overrides,
});

describe('recurringService.createRecurring — validation', () => {
  test('requires title', async () => {
    await expect(service.createRecurring(1, validPayload({ title: '' })))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('requires positive amount', async () => {
    await expect(service.createRecurring(1, validPayload({ amount: -10 })))
      .rejects.toThrow(/greater than zero/);
    await expect(service.createRecurring(1, validPayload({ amount: 0 })))
      .rejects.toThrow(/greater than zero/);
  });

  test('restricts type to income/expense', async () => {
    await expect(service.createRecurring(1, validPayload({ type: 'gift' })))
      .rejects.toThrow(/income or expense/);
  });

  test('restricts frequency to weekly/monthly/yearly', async () => {
    await expect(service.createRecurring(1, validPayload({ frequency: 'daily' })))
      .rejects.toThrow(/weekly, monthly, or yearly/);
  });

  test('requires ISO date for next_due_date', async () => {
    await expect(service.createRecurring(1, validPayload({ next_due_date: '2026/06/01' })))
      .rejects.toThrow(/YYYY-MM-DD/);
  });

  test('accepts optional category_id and wallet_id', async () => {
    recurringModel.create.mockImplementation(async (uid, p) => ({ id: 1, ...p }));
    const result = await service.createRecurring(1, validPayload({ category_id: 5, wallet_id: 2 }));
    expect(recurringModel.create).toHaveBeenCalledWith(1, expect.objectContaining({
      category_id: 5, wallet_id: 2,
    }));
    expect(result.id).toBe(1);
  });

  test('treats empty FK strings as null', async () => {
    recurringModel.create.mockImplementation(async (uid, p) => p);
    const result = await service.createRecurring(1, validPayload({ category_id: '', wallet_id: '' }));
    expect(result.category_id).toBeNull();
    expect(result.wallet_id).toBeNull();
  });
});

describe('recurringService — multi-tenant isolation', () => {
  test('create rejects category_id owned by another user', async () => {
    categoryModel.getById.mockResolvedValueOnce(undefined);
    await expect(service.createRecurring(1, validPayload({ category_id: 999 })))
      .rejects.toThrow(/Invalid category_id/);
    expect(recurringModel.create).not.toHaveBeenCalled();
  });

  test('create rejects wallet_id owned by another user', async () => {
    walletModel.getById.mockResolvedValueOnce(undefined);
    await expect(service.createRecurring(1, validPayload({ wallet_id: 888 })))
      .rejects.toThrow(/Invalid wallet_id/);
    expect(recurringModel.create).not.toHaveBeenCalled();
  });

  test('update rejects category_id owned by another user', async () => {
    recurringModel.getById.mockResolvedValue({ id: 7, user_id: 1 });
    categoryModel.getById.mockResolvedValueOnce(undefined);
    await expect(service.updateRecurring(7, 1, validPayload({ category_id: 999 })))
      .rejects.toThrow(/Invalid category_id/);
    expect(recurringModel.update).not.toHaveBeenCalled();
  });
});

describe('recurringService.getRecurringById', () => {
  test('throws NotFound when missing', async () => {
    recurringModel.getById.mockResolvedValue(undefined);
    await expect(service.getRecurringById(1, 1)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('recurringService.getUpcoming', () => {
  test('defaults limit to 5', async () => {
    recurringModel.getUpcoming.mockResolvedValue([]);
    await service.getUpcoming(1);
    expect(recurringModel.getUpcoming).toHaveBeenCalledWith(1, 5);
  });

  test('honors explicit limit', async () => {
    recurringModel.getUpcoming.mockResolvedValue([]);
    await service.getUpcoming(1, 10);
    expect(recurringModel.getUpcoming).toHaveBeenCalledWith(1, 10);
  });

  test('falls back to 5 on invalid limit', async () => {
    recurringModel.getUpcoming.mockResolvedValue([]);
    await service.getUpcoming(1, -3);
    expect(recurringModel.getUpcoming).toHaveBeenCalledWith(1, 5);
  });
});

describe('recurringService.rollNextDueDate', () => {
  test('advances monthly recurrence by one month', async () => {
    recurringModel.getById.mockResolvedValue({
      id: 1, frequency: 'monthly', next_due_date: '2026-06-01',
      title: 'Rent', amount: 100, type: 'expense',
    });
    recurringModel.update.mockImplementation(async (id, uid, p) => ({ id, ...p }));
    const result = await service.rollNextDueDate(1, 1);
    expect(result.next_due_date).toBe('2026-07-01');
  });

  test('handles weekly recurrence', async () => {
    recurringModel.getById.mockResolvedValue({
      id: 1, frequency: 'weekly', next_due_date: '2026-05-20',
      title: 'Groceries', amount: 100, type: 'expense',
    });
    recurringModel.update.mockImplementation(async (id, uid, p) => ({ id, ...p }));
    const result = await service.rollNextDueDate(1, 1);
    expect(result.next_due_date).toBe('2026-05-27');
  });
});
