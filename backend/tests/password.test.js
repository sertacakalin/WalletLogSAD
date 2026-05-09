const password = require('../utils/password');

describe('utils/password', () => {
  // Lower the cost during tests so this stays fast.
  beforeAll(() => { process.env.BCRYPT_COST = '4'; });

  test('hash + compare round-trip succeeds', async () => {
    const hashed = await password.hash('Sup3rSecret');
    expect(hashed).not.toBe('Sup3rSecret');
    expect(typeof hashed).toBe('string');
    expect(hashed.length).toBeGreaterThan(20);
    expect(await password.compare('Sup3rSecret', hashed)).toBe(true);
  });

  test('compare returns false on wrong password', async () => {
    const hashed = await password.hash('correct1');
    expect(await password.compare('wrong1234', hashed)).toBe(false);
  });

  test('compare returns false when stored hash is empty', async () => {
    expect(await password.compare('anything', '')).toBe(false);
    expect(await password.compare('anything', null)).toBe(false);
    expect(await password.compare('anything', undefined)).toBe(false);
  });

  test('two hashes of the same password differ (salted)', async () => {
    const a = await password.hash('samePass1');
    const b = await password.hash('samePass1');
    expect(a).not.toBe(b);
  });
});
