const service = require('../services/budgetService');
const { ValidationError, NotFoundError } = require('../errors');

jest.mock('../models/budgetModel', () => ({
  getAll:  jest.fn(),
  getById: jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
  remove:  jest.fn(),
}));

jest.mock('../models/transactionModel', () => ({
  getAll: jest.fn(),
}));

const budgetModel      = require('../models/budgetModel');
const transactionModel = require('../models/transactionModel');

const USER_ID = 1;
const validPayload = { category_id: 1, month: 5, year: 2026, limit_amount: 500 };

describe('budgetService — create', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects missing category_id', async () => {
    await expect(service.createBudget(USER_ID, { ...validPayload, category_id: undefined }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects month out of range', async () => {
    await expect(service.createBudget(USER_ID, { ...validPayload, month: 0 }))
      .rejects.toThrow(/Invalid month/);
    await expect(service.createBudget(USER_ID, { ...validPayload, month: 13 }))
      .rejects.toThrow(/Invalid month/);
  });

  test('rejects non-integer year', async () => {
    await expect(service.createBudget(USER_ID, { ...validPayload, year: 'abc' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects zero or negative limit_amount', async () => {
    await expect(service.createBudget(USER_ID, { ...validPayload, limit_amount: 0 }))
      .rejects.toThrow(/greater than zero/);
    await expect(service.createBudget(USER_ID, { ...validPayload, limit_amount: -100 }))
      .rejects.toThrow(/greater than zero/);
  });

  test('passes user_id and coerced numeric payload to model', async () => {
    budgetModel.create.mockResolvedValue({ id: 1 });
    await service.createBudget(USER_ID, { category_id: '1', month: '5', year: '2026', limit_amount: '500.50' });
    expect(budgetModel.create).toHaveBeenCalledWith(USER_ID, {
      category_id: 1, month: 5, year: 2026, limit_amount: 500.5,
    });
  });

  test('rejects invalid user', async () => {
    await expect(service.createBudget(0, validPayload))
      .rejects.toBeInstanceOf(ValidationError);
  });
});

describe('budgetService — update', () => {
  afterEach(() => jest.clearAllMocks());

  test('throws NotFound when budget missing or another user owns it', async () => {
    budgetModel.getById.mockResolvedValue(undefined);
    await expect(service.updateBudget(99, USER_ID, { limit_amount: 100 }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  test('rejects invalid limit', async () => {
    await expect(service.updateBudget(1, USER_ID, { limit_amount: -1 }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('updates the limit scoped by user', async () => {
    budgetModel.getById.mockResolvedValue({ id: 4, user_id: USER_ID });
    budgetModel.update.mockResolvedValue({ id: 4, limit_amount: 200, user_id: USER_ID });
    const result = await service.updateBudget(4, USER_ID, { limit_amount: 200 });
    expect(result.limit_amount).toBe(200);
    expect(budgetModel.update).toHaveBeenCalledWith(4, USER_ID, { limit_amount: 200 });
  });
});

describe('budgetService — delete', () => {
  afterEach(() => jest.clearAllMocks());

  test('throws NotFound when missing', async () => {
    budgetModel.getById.mockResolvedValue(undefined);
    await expect(service.deleteBudget(7, USER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('removes existing row scoped by user', async () => {
    budgetModel.getById.mockResolvedValue({ id: 7, user_id: USER_ID });
    await service.deleteBudget(7, USER_ID);
    expect(budgetModel.remove).toHaveBeenCalledWith(7, USER_ID);
  });
});

describe('budgetService — getBudgetStatus', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects invalid month', async () => {
    await expect(service.getBudgetStatus(USER_ID, 13, 2026))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('returns empty list when no budgets for given month', async () => {
    budgetModel.getAll.mockResolvedValue([
      { id: 1, category_id: 1, month: 1, year: 2026, limit_amount: 100, category_name: 'Food', user_id: USER_ID },
    ]);
    const result = await service.getBudgetStatus(USER_ID, 2, 2026);
    expect(result).toEqual([]);
  });

  test('computes spent and remaining correctly when under limit', async () => {
    budgetModel.getAll.mockResolvedValue([
      { id: 1, category_id: 1, month: 5, year: 2026, limit_amount: 500, category_name: 'Food', user_id: USER_ID },
    ]);
    transactionModel.getAll.mockResolvedValue([
      { type: 'expense', amount: '120' },
      { type: 'expense', amount: '80'  },
    ]);
    const result = await service.getBudgetStatus(USER_ID, 5, 2026);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      category: 'Food',
      limit: 500,
      spent: 200,
      remaining: 300,
      exceeded: false,
    });
    expect(transactionModel.getAll).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      category_id: 1, type: 'expense',
    }));
  });

  test('flags exceeded when spent > limit', async () => {
    budgetModel.getAll.mockResolvedValue([
      { id: 2, category_id: 2, month: 5, year: 2026, limit_amount: 100, category_name: 'Coffee', user_id: USER_ID },
    ]);
    transactionModel.getAll.mockResolvedValue([
      { type: 'expense', amount: '150' },
    ]);
    const [row] = await service.getBudgetStatus(USER_ID, 5, 2026);
    expect(row.spent).toBe(150);
    expect(row.remaining).toBe(-50);
    expect(row.exceeded).toBe(true);
  });

  test('queries transactions with proper month range (April = 30 days) scoped by user', async () => {
    budgetModel.getAll.mockResolvedValue([
      { id: 1, category_id: 1, month: 4, year: 2026, limit_amount: 100, category_name: 'X', user_id: USER_ID },
    ]);
    transactionModel.getAll.mockResolvedValue([]);
    await service.getBudgetStatus(USER_ID, 4, 2026);
    expect(transactionModel.getAll).toHaveBeenCalledWith(USER_ID, {
      category_id: 1,
      type: 'expense',
      startDate: '2026-04-01',
      endDate:   '2026-04-30',
    });
  });
});

describe('budgetService — getById', () => {
  afterEach(() => jest.clearAllMocks());

  test('throws ValidationError on bad id', async () => {
    await expect(service.getBudgetById('xyz', USER_ID)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws NotFound when missing or another user owns it', async () => {
    budgetModel.getById.mockResolvedValue(undefined);
    await expect(service.getBudgetById(101, USER_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(budgetModel.getById).toHaveBeenCalledWith(101, USER_ID);
  });

  test('returns row when found', async () => {
    const row = { id: 1, limit_amount: 200, user_id: USER_ID };
    budgetModel.getById.mockResolvedValue(row);
    expect(await service.getBudgetById(1, USER_ID)).toEqual(row);
  });
});
