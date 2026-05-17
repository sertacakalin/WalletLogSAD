jest.mock('../models/walletModel', () => ({
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  getBalances: jest.fn(),
}));

const walletModel = require('../models/walletModel');
const service = require('../services/walletService');
const { ValidationError, NotFoundError, ConflictError } = require('../errors');

afterEach(() => jest.clearAllMocks());

describe('walletService.createWallet — validation', () => {
  test('rejects missing name', async () => {
    await expect(service.createWallet(1, { name: '' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.createWallet(1, {})).rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects name longer than 80 chars', async () => {
    await expect(service.createWallet(1, { name: 'x'.repeat(81) }))
      .rejects.toThrow(/at most 80/);
  });

  test('rejects invalid hex color', async () => {
    await expect(service.createWallet(1, { name: 'Cash', color: 'red' }))
      .rejects.toThrow(/hex/);
  });

  test('rejects non-numeric initial_balance', async () => {
    await expect(service.createWallet(1, { name: 'Cash', initial_balance: 'lots' }))
      .rejects.toThrow(/number/);
  });

  test('defaults color and initial_balance when missing', async () => {
    walletModel.create.mockImplementation(async (uid, payload) => ({ id: 1, user_id: uid, ...payload }));
    const result = await service.createWallet(1, { name: '  Bank  ' });
    expect(walletModel.create).toHaveBeenCalledWith(1, {
      name: 'Bank',
      color: '#3a3733',
      initial_balance: 0,
    });
    expect(result.name).toBe('Bank');
  });

  test('translates 23505 to ConflictError', async () => {
    walletModel.create.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(service.createWallet(1, { name: 'Bank' })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('walletService.getWalletById', () => {
  test('throws NotFound when missing', async () => {
    walletModel.getById.mockResolvedValue(undefined);
    await expect(service.getWalletById(1, 1)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('returns wallet when found', async () => {
    walletModel.getById.mockResolvedValue({ id: 1, name: 'Cash' });
    expect(await service.getWalletById(1, 1)).toEqual({ id: 1, name: 'Cash' });
  });
});

describe('walletService.updateWallet', () => {
  test('verifies existence before updating', async () => {
    walletModel.getById.mockResolvedValue(undefined);
    await expect(service.updateWallet(1, 1, { name: 'X' }))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(walletModel.update).not.toHaveBeenCalled();
  });

  test('updates when valid', async () => {
    walletModel.getById.mockResolvedValue({ id: 1, name: 'Cash' });
    walletModel.update.mockResolvedValue({ id: 1, name: 'Bank' });
    const result = await service.updateWallet(1, 1, { name: 'Bank', initial_balance: 100 });
    expect(result.name).toBe('Bank');
  });
});

describe('walletService.deleteWallet', () => {
  test('throws NotFound when missing', async () => {
    walletModel.getById.mockResolvedValue(undefined);
    await expect(service.deleteWallet(1, 1)).rejects.toBeInstanceOf(NotFoundError);
    expect(walletModel.remove).not.toHaveBeenCalled();
  });

  test('removes when present', async () => {
    walletModel.getById.mockResolvedValue({ id: 1 });
    await service.deleteWallet(1, 1);
    expect(walletModel.remove).toHaveBeenCalledWith(1, 1);
  });
});

describe('walletService.getWalletBalances', () => {
  test('computes balance = initial + income - expense', async () => {
    walletModel.getBalances.mockResolvedValue([
      { id: 1, name: 'Cash', color: '#000', initial_balance: '50.00', income: '200.00', expense: '30.00' },
      { id: 2, name: 'Bank', color: '#000', initial_balance: '0',     income: '0',      expense: '0' },
    ]);
    const result = await service.getWalletBalances(1);
    expect(result).toEqual([
      { id: 1, name: 'Cash', color: '#000', initial_balance: 50, income: 200, expense: 30, balance: 220 },
      { id: 2, name: 'Bank', color: '#000', initial_balance: 0,  income: 0,   expense: 0,  balance: 0 },
    ]);
  });
});

describe('walletService.getAllWallets', () => {
  test('passes through to model', async () => {
    walletModel.getAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    expect(await service.getAllWallets(1)).toHaveLength(2);
  });

  test('rejects invalid user id', async () => {
    await expect(service.getAllWallets('not-a-number')).rejects.toBeInstanceOf(ValidationError);
  });
});
