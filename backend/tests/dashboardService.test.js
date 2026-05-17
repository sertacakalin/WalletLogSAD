const service = require('../services/dashboardService');
const { buildInsights, computeSavingsRate, decorateUpcoming } = service._internals;

describe('dashboardService.computeSavingsRate', () => {
  test('returns 0 when income is zero', () => {
    expect(computeSavingsRate(0, 0)).toBe(0);
    expect(computeSavingsRate(0, 500)).toBe(0);
  });

  test('returns 100 when expense is zero', () => {
    expect(computeSavingsRate(1000, 0)).toBe(100);
  });

  test('rounds to nearest integer percentage', () => {
    expect(computeSavingsRate(1000, 333)).toBe(67);
    expect(computeSavingsRate(42000, 23550)).toBe(44); // similar to user example
  });

  test('returns negative when overspending', () => {
    expect(computeSavingsRate(1000, 1500)).toBe(-50);
  });
});

describe('dashboardService.buildInsights', () => {
  test('returns empty array when nothing notable', () => {
    expect(buildInsights({
      monthlyExpense: 100, prevMonthExpense: 100,
      categoryExpenses: [], budgets: [],
      savingsRate: 40, prevSavingsRate: 40,
    })).toEqual([]);
  });

  test('prioritizes exceeded budgets first', () => {
    const insights = buildInsights({
      monthlyExpense: 500,
      prevMonthExpense: 400,
      categoryExpenses: [{ category: 'Food', total: 300 }],
      budgets: [
        { category: 'Food', limit: 100, spent: 150, exceeded: true },
        { category: 'Fun',  limit: 50,  spent: 200, exceeded: true },
      ],
      savingsRate: 10, prevSavingsRate: 10,
    });
    // Fun overspent by 150, Food by 50 → Fun first.
    expect(insights[0].level).toBe('warning');
    expect(insights[0].message).toMatch(/Fun/);
    expect(insights[0].message).toMatch(/150/);
    expect(insights[1].message).toMatch(/Food/);
  });

  test('flags spending increase > 10%', () => {
    const insights = buildInsights({
      monthlyExpense: 200, prevMonthExpense: 100,
      categoryExpenses: [], budgets: [],
      savingsRate: 0, prevSavingsRate: 0,
    });
    expect(insights[0].level).toBe('warning');
    expect(insights[0].message).toMatch(/100%/);
  });

  test('flags spending decrease > 10% as positive', () => {
    const insights = buildInsights({
      monthlyExpense: 50, prevMonthExpense: 100,
      categoryExpenses: [], budgets: [],
      savingsRate: 0, prevSavingsRate: 0,
    });
    expect(insights[0].level).toBe('positive');
    expect(insights[0].message).toMatch(/decreased/);
  });

  test('flags dominant category at >= 30%', () => {
    const insights = buildInsights({
      monthlyExpense: 1000, prevMonthExpense: 1000,
      categoryExpenses: [{ category: 'Food', total: 400 }],
      budgets: [],
      savingsRate: 0, prevSavingsRate: 0,
    });
    expect(insights[0].message).toMatch(/Food.*highest spending/);
  });

  test('flags savings rate improvement >= 5 points', () => {
    const insights = buildInsights({
      monthlyExpense: 100, prevMonthExpense: 100,
      categoryExpenses: [], budgets: [],
      savingsRate: 50, prevSavingsRate: 30,
    });
    expect(insights[0].level).toBe('positive');
    expect(insights[0].message).toMatch(/savings rate improved/i);
  });

  test('caps output at 3 insights', () => {
    const insights = buildInsights({
      monthlyExpense: 500, prevMonthExpense: 100,  // spending up
      categoryExpenses: [{ category: 'Food', total: 400 }], // dominant
      budgets: [
        { category: 'A', limit: 10, spent: 100, exceeded: true },
        { category: 'B', limit: 10, spent: 90, exceeded: true },
        { category: 'C', limit: 10, spent: 80, exceeded: true },
        { category: 'D', limit: 10, spent: 70, exceeded: true },
      ],
      savingsRate: 50, prevSavingsRate: 10,  // improved
    });
    expect(insights).toHaveLength(3);
    // First three should all be warnings (exceeded budgets — top 3).
    expect(insights.every((i) => i.level === 'warning')).toBe(true);
  });
});

describe('dashboardService.decorateUpcoming', () => {
  test('marks overdue when next_due_date is in the past', () => {
    const result = decorateUpcoming([{
      id: 1, title: 'Rent', amount: '100', type: 'expense',
      frequency: 'monthly', next_due_date: '2026-05-10',
    }], '2026-05-17');
    expect(result[0].status).toBe('overdue');
    expect(result[0].days_until).toBe(-7);
  });

  test('marks due_soon when within 3 days', () => {
    const result = decorateUpcoming([{
      id: 1, title: 'Rent', amount: '100', type: 'expense',
      frequency: 'monthly', next_due_date: '2026-05-19',
    }], '2026-05-17');
    expect(result[0].status).toBe('due_soon');
    expect(result[0].days_until).toBe(2);
  });

  test('marks upcoming when more than 3 days away', () => {
    const result = decorateUpcoming([{
      id: 1, title: 'Rent', amount: '100', type: 'expense',
      frequency: 'monthly', next_due_date: '2026-06-01',
    }], '2026-05-17');
    expect(result[0].status).toBe('upcoming');
    expect(result[0].days_until).toBe(15);
  });

  test('coerces amount to Number', () => {
    const result = decorateUpcoming([{
      id: 1, title: 'Rent', amount: '100.50', type: 'expense',
      frequency: 'monthly', next_due_date: '2026-06-01',
    }], '2026-05-17');
    expect(result[0].amount).toBe(100.5);
  });
});
