const { isValidMonth, isValidYear, monthRange, isValidISODate } = require('../utils/dates');

describe('utils/dates — month/year validators', () => {
  test('isValidMonth accepts 1-12', () => {
    [1, 6, 12].forEach((m) => expect(isValidMonth(m)).toBe(true));
  });
  test('isValidMonth rejects out-of-range', () => {
    [0, 13, -1, 1.5, '5'].forEach((m) => expect(isValidMonth(m)).toBe(false));
  });
  test('isValidYear accepts plausible years', () => {
    [1900, 2026, 2999].forEach((y) => expect(isValidYear(y)).toBe(true));
  });
  test('isValidYear rejects extremes', () => {
    [1899, 3000, 'abc'].forEach((y) => expect(isValidYear(y)).toBe(false));
  });
});

describe('utils/dates — monthRange', () => {
  test('returns correct range for January', () => {
    expect(monthRange(1, 2026)).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
  });
  test('Feb non-leap year has 28 days', () => {
    expect(monthRange(2, 2025)).toEqual({ startDate: '2025-02-01', endDate: '2025-02-28' });
  });
  test('Feb leap year has 29 days', () => {
    expect(monthRange(2, 2024)).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' });
  });
  test('April has 30 days', () => {
    expect(monthRange(4, 2026).endDate).toBe('2026-04-30');
  });
  test('throws on invalid month', () => {
    expect(() => monthRange(0, 2026)).toThrow(/Invalid month/);
    expect(() => monthRange(13, 2026)).toThrow(/Invalid month/);
  });
  test('coerces string inputs', () => {
    expect(monthRange('5', '2026')).toEqual({ startDate: '2026-05-01', endDate: '2026-05-31' });
  });
});

describe('utils/dates — isValidISODate', () => {
  test('accepts well-formed dates', () => {
    expect(isValidISODate('2026-01-15')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true);
  });
  test('rejects bad formats and bad values', () => {
    ['2026/01/15', '15-01-2026', '', null, undefined, '2026-13-01']
      .forEach((s) => expect(isValidISODate(s)).toBe(false));
  });
});
