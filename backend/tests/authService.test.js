process.env.JWT_ACCESS_SECRET = 'test-secret-must-be-long-enough-12345';
process.env.BCRYPT_COST = '4';

jest.mock('../models/userModel', () => ({
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  existsByEmail: jest.fn(),
}));

jest.mock('../models/refreshTokenModel', () => ({
  create: jest.fn(),
  findByHash: jest.fn(),
  revoke: jest.fn(),
  revokeAllForUser: jest.fn(),
  deleteExpired: jest.fn(),
}));

const userModel = require('../models/userModel');
const refreshTokenModel = require('../models/refreshTokenModel');
const password = require('../utils/password');
const { hashRefreshToken } = require('../utils/tokens');
const service = require('../services/authService');
const { ValidationError, ConflictError, UnauthorizedError } = require('../errors');

const FAKE_USER_ROW = (overrides = {}) => ({
  id: 1,
  email: 'deniz@example.com',
  display_name: 'Deniz',
  ...overrides,
});

describe('authService.register — validation', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects bad email', async () => {
    await expect(service.register({ email: 'not-an-email', password: 'Sup3rSecret' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects short password', async () => {
    await expect(service.register({ email: 'a@b.com', password: 'short1' }))
      .rejects.toThrow(/at least 8/);
  });

  test('rejects password without a digit', async () => {
    await expect(service.register({ email: 'a@b.com', password: 'allletters' }))
      .rejects.toThrow(/digit/);
  });

  test('rejects password without a letter', async () => {
    await expect(service.register({ email: 'a@b.com', password: '12345678' }))
      .rejects.toThrow(/letter/);
  });

  test('rejects long display name', async () => {
    await expect(service.register({ email: 'a@b.com', password: 'Sup3rSecret', displayName: 'x'.repeat(81) }))
      .rejects.toThrow(/at most 80/);
  });

  test('throws ConflictError when email already exists', async () => {
    userModel.existsByEmail.mockResolvedValue(true);
    await expect(service.register({ email: 'taken@example.com', password: 'Sup3rSecret' }))
      .rejects.toBeInstanceOf(ConflictError);
  });
});

describe('authService.register — happy path', () => {
  afterEach(() => jest.clearAllMocks());

  test('hashes password, lowercases email, creates user, issues tokens', async () => {
    userModel.existsByEmail.mockResolvedValue(false);
    userModel.create.mockImplementation(async ({ email, passwordHash, displayName }) => ({
      id: 7, email, display_name: displayName, password_hash: passwordHash,
    }));
    refreshTokenModel.create.mockImplementation(async (args) => ({ id: 100, ...args }));

    const result = await service.register({
      email: '  Deniz@Example.COM  ',
      password: 'Sup3rSecret',
      displayName: '  Deniz ',
    });

    expect(userModel.existsByEmail).toHaveBeenCalledWith('deniz@example.com');
    expect(userModel.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'deniz@example.com',
      displayName: 'Deniz',
    }));
    // password is hashed, not stored plain
    const createArg = userModel.create.mock.calls[0][0];
    expect(createArg.passwordHash).not.toBe('Sup3rSecret');
    expect(await password.compare('Sup3rSecret', createArg.passwordHash)).toBe(true);

    expect(result.user).toEqual({ id: 7, email: 'deniz@example.com', display_name: 'Deniz' });
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    expect(refreshTokenModel.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
    }));
  });
});

describe('authService.login', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns 401 (UnauthorizedError) on unknown email', async () => {
    userModel.findByEmail.mockResolvedValue(undefined);
    await expect(service.login({ email: 'nope@example.com', password: 'whatever1' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('returns 401 on wrong password (same error type as unknown email)', async () => {
    const hashed = await password.hash('correctPassword1');
    userModel.findByEmail.mockResolvedValue(FAKE_USER_ROW({ password_hash: hashed }));
    await expect(service.login({ email: 'deniz@example.com', password: 'wrongPassword1' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('issues access + refresh on valid credentials', async () => {
    const hashed = await password.hash('correctPassword1');
    userModel.findByEmail.mockResolvedValue(FAKE_USER_ROW({ password_hash: hashed }));
    refreshTokenModel.create.mockImplementation(async (args) => ({ id: 50, ...args }));

    const result = await service.login({ email: 'deniz@example.com', password: 'correctPassword1' });
    expect(result.user).toEqual({ id: 1, email: 'deniz@example.com', display_name: 'Deniz' });
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
  });

  test('non-string credentials are rejected with 401', async () => {
    await expect(service.login({ email: null, password: 'Sup3rSecret' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
    await expect(service.login({ email: 'a@b.com', password: 12345678 }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('authService.refresh', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects when no token provided', async () => {
    await expect(service.refresh({ refreshToken: '' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('rejects unknown token', async () => {
    refreshTokenModel.findByHash.mockResolvedValue(undefined);
    await expect(service.refresh({ refreshToken: 'fake' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('rotates token and returns a new one on success', async () => {
    const oldRow = {
      id: 10,
      user_id: 1,
      revoked_at: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    refreshTokenModel.findByHash.mockResolvedValue(oldRow);
    userModel.findById.mockResolvedValue(FAKE_USER_ROW());
    refreshTokenModel.create.mockImplementation(async (args) => ({ id: 11, ...args }));

    const before = 'old-token';
    const result = await service.refresh({ refreshToken: before });

    expect(refreshTokenModel.create).toHaveBeenCalled();
    expect(refreshTokenModel.revoke).toHaveBeenCalledWith(10, 11);
    expect(result.refreshToken).not.toBe(before);
    expect(typeof result.accessToken).toBe('string');
  });

  test('reuse of a revoked token revokes the entire family', async () => {
    refreshTokenModel.findByHash.mockResolvedValue({
      id: 5,
      user_id: 1,
      revoked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(service.refresh({ refreshToken: 'reused' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(refreshTokenModel.revokeAllForUser).toHaveBeenCalledWith(1);
  });

  test('expired token is rejected and revoked', async () => {
    refreshTokenModel.findByHash.mockResolvedValue({
      id: 6,
      user_id: 1,
      revoked_at: null,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(service.refresh({ refreshToken: 'expired' }))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(refreshTokenModel.revoke).toHaveBeenCalledWith(6);
  });
});

describe('authService.logout', () => {
  afterEach(() => jest.clearAllMocks());

  test('does nothing when no token is given', async () => {
    await service.logout({ refreshToken: '' });
    expect(refreshTokenModel.findByHash).not.toHaveBeenCalled();
    expect(refreshTokenModel.revoke).not.toHaveBeenCalled();
  });

  test('revokes the matching token', async () => {
    const tokenRow = { id: 9, user_id: 1, revoked_at: null };
    refreshTokenModel.findByHash.mockResolvedValue(tokenRow);
    await service.logout({ refreshToken: 'good-token' });
    expect(refreshTokenModel.findByHash).toHaveBeenCalledWith(hashRefreshToken('good-token'));
    expect(refreshTokenModel.revoke).toHaveBeenCalledWith(9);
  });

  test('idempotent on already-revoked tokens', async () => {
    refreshTokenModel.findByHash.mockResolvedValue({ id: 9, revoked_at: new Date().toISOString() });
    await service.logout({ refreshToken: 'already-revoked' });
    expect(refreshTokenModel.revoke).not.toHaveBeenCalled();
  });
});

describe('authService.me', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns the public user view', async () => {
    userModel.findById.mockResolvedValue(FAKE_USER_ROW());
    const result = await service.me(1);
    expect(result).toEqual({ id: 1, email: 'deniz@example.com', display_name: 'Deniz' });
  });

  test('throws Unauthorized when user is missing', async () => {
    userModel.findById.mockResolvedValue(undefined);
    await expect(service.me(99)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
