const service = require('../services/transactionService');
const { ValidationError, NotFoundError } = require('../errors');

jest.mock('../models/transactionModel', () => ({
  getAll:  jest.fn(),
  getById: jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
  remove:  jest.fn(),
}));

const model = require('../models/transactionModel');

const USER_ID = 1;

const validPayload = {
  title: 'Market shopping',
  amount: 150,
  type: 'expense',
  date: '2026-01-15',
  category_id: 1,
  note: 'weekly groceries',
};

describe('transactionService — validation', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects empty title with ValidationError', async () => {
    await expect(service.createTransaction(USER_ID, { ...validPayload, title: '   ' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects title longer than 200 chars', async () => {
    await expect(service.createTransaction(USER_ID, { ...validPayload, title: 'a'.repeat(201) }))
      .rejects.toThrow(/at most 200/);
  });

  test('rejects zero or negative amount', async () => {
    await expect(service.createTransaction(USER_ID, { ...validPayload, amount: 0 }))
      .rejects.toThrow(/greater than zero/);
    await expect(service.createTransaction(USER_ID, { ...validPayload, amount: -5 }))
      .rejects.toThrow(/greater than zero/);
  });

  test('rejects non-numeric amount', async () => {
    await expect(service.createTransaction(USER_ID, { ...validPayload, amount: 'abc' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects type outside of income/expense', async () => {
    await expect(service.createTransaction(USER_ID, { ...validPayload, type: 'transfer' }))
      .rejects.toThrow(/income or expense/);
  });

  test('rejects malformed date', async () => {
    await expect(service.createTransaction(USER_ID, { ...validPayload, date: '2026/01/15' }))
      .rejects.toThrow(/YYYY-MM-DD/);
    await expect(service.createTransaction(USER_ID, { ...validPayload, date: '' }))
      .rejects.toThrow(/YYYY-MM-DD/);
  });

  test('accepts payload without category_id (optional FK)', async () => {
    const fake = { id: 1 };
    model.create.mockResolvedValue(fake);
    const result = await service.createTransaction(USER_ID, { ...validPayload, category_id: null });
    expect(result).toEqual(fake);
    expect(model.create).toHaveBeenCalledWith(USER_ID, expect.objectContaining({ category_id: null }));
  });

  test('rejects negative category_id', async () => {
    await expect(service.createTransaction(USER_ID, { ...validPayload, category_id: -1 }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('passes sanitized payload + user_id to model on create', async () => {
    model.create.mockResolvedValue({ id: 99 });
    await service.createTransaction(USER_ID, { ...validPayload, title: '  trimmed  ', amount: '42.50' });
    expect(model.create).toHaveBeenCalledWith(USER_ID, expect.objectContaining({
      title: 'trimmed',
      amount: 42.5,
    }));
  });

  test('rejects invalid user', async () => {
    await expect(service.createTransaction(0, validPayload))
      .rejects.toBeInstanceOf(ValidationError);
  });
});

describe('transactionService — getById', () => {
  afterEach(() => jest.clearAllMocks());

  test('throws NotFoundError when missing or owned by another user', async () => {
    model.getById.mockResolvedValue(undefined);
    await expect(service.getTransactionById(999, USER_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(model.getById).toHaveBeenCalledWith(999, USER_ID);
  });

  test('throws ValidationError on bad id', async () => {
    await expect(service.getTransactionById('abc', USER_ID)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.getTransactionById(0, USER_ID)).rejects.toBeInstanceOf(ValidationError);
  });

  test('returns transaction when found', async () => {
    const fake = { id: 5, title: 'Coffee', user_id: USER_ID };
    model.getById.mockResolvedValue(fake);
    expect(await service.getTransactionById(5, USER_ID)).toEqual(fake);
  });
});

describe('transactionService — update / delete', () => {
  afterEach(() => jest.clearAllMocks());

  test('update fails fast if id is missing', async () => {
    await expect(service.updateTransaction('xyz', USER_ID, validPayload))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('update returns updated row scoped by user', async () => {
    model.getById.mockResolvedValue({ id: 7, user_id: USER_ID });
    model.update.mockResolvedValue({ id: 7, title: 'Updated', user_id: USER_ID });
    const result = await service.updateTransaction(7, USER_ID, validPayload);
    expect(result.title).toBe('Updated');
    expect(model.update).toHaveBeenCalledWith(7, USER_ID, expect.any(Object));
  });

  test('delete throws NotFound when row missing or another user owns it', async () => {
    model.getById.mockResolvedValue(undefined);
    await expect(service.deleteTransaction(123, USER_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('delete calls model.remove on existing row scoped by user', async () => {
    model.getById.mockResolvedValue({ id: 4, user_id: USER_ID });
    await service.deleteTransaction(4, USER_ID);
    expect(model.remove).toHaveBeenCalledWith(4, USER_ID);
  });
});

describe('transactionService — filters', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects invalid type filter', async () => {
    await expect(service.getAllTransactions(USER_ID, { type: 'transfer' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects invalid date filter', async () => {
    await expect(service.getAllTransactions(USER_ID, { startDate: 'bad' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('passes whitelisted filters + user_id through to model', async () => {
    model.getAll.mockResolvedValue([]);
    await service.getAllTransactions(USER_ID, {
      type: 'income',
      category_id: '3',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      sneaky: 'DROP TABLE',
    });
    expect(model.getAll).toHaveBeenCalledWith(USER_ID, {
      type: 'income',
      category_id: 3,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
  });
});

describe('transactionService — monthly summary', () => {
  afterEach(() => jest.clearAllMocks());

  test('sums income/expense and computes balance', async () => {
    model.getAll.mockResolvedValue([
      { type: 'income',  amount: '1000' },
      { type: 'expense', amount: '400'  },
      { type: 'expense', amount: '200'  },
    ]);
    const r = await service.getMonthlySummary(USER_ID, 1, 2026);
    expect(r.income).toBe(1000);
    expect(r.expense).toBe(600);
    expect(r.balance).toBe(400);
  });

  test('handles empty month with zeroes', async () => {
    model.getAll.mockResolvedValue([]);
    const r = await service.getMonthlySummary(USER_ID, 7, 2026);
    expect(r).toEqual({ income: 0, expense: 0, balance: 0 });
  });

  test('rejects invalid month', async () => {
    await expect(service.getMonthlySummary(USER_ID, 13, 2026))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('queries correct date range for February (28 days) scoped by user', async () => {
    model.getAll.mockResolvedValue([]);
    await service.getMonthlySummary(USER_ID, 2, 2025);
    expect(model.getAll).toHaveBeenCalledWith(USER_ID, {
      startDate: '2025-02-01',
      endDate:   '2025-02-28',
    });
  });

  test('queries correct date range for February of leap year (29 days)', async () => {
    model.getAll.mockResolvedValue([]);
    await service.getMonthlySummary(USER_ID, 2, 2024);
    expect(model.getAll).toHaveBeenCalledWith(USER_ID, {
      startDate: '2024-02-01',
      endDate:   '2024-02-29',
    });
  });
});
