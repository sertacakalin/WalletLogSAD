const dashboardModel = require('../models/dashboardModel');
const walletModel    = require('../models/walletModel');
const transactionModel = require('../models/transactionModel');
const budgetService    = require('./budgetService');
const recurringService = require('./recurringService');
const { ValidationError } = require('../errors');
const {
  monthRange, isValidMonth, isValidYear, previousMonth, todayISO, daysBetween,
} = require('../utils/dates');

const validateUserId = (userId) => {
  const n = Number(userId);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError('Invalid user');
  return n;
};

const round2 = (n) => Math.round(n * 100) / 100;

// Pure function. Exposed so insights logic can be unit tested without DB.
const buildInsights = ({
  monthlyExpense,
  prevMonthExpense,
  categoryExpenses,
  budgets,
  savingsRate,
  prevSavingsRate,
}) => {
  const insights = [];

  // Priority 1 — exceeded budgets (warnings).
  const exceeded = (budgets || [])
    .filter((b) => b.exceeded)
    .sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit));
  for (const b of exceeded) {
    if (insights.length >= 3) break;
    const over = round2(b.spent - b.limit);
    insights.push({
      level: 'warning',
      message: `You exceeded your ${b.category || 'budget'} budget by ${over}.`,
    });
  }

  // Priority 2 — spending up vs last month by > 10%.
  if (insights.length < 3 && prevMonthExpense > 0) {
    const delta = ((monthlyExpense - prevMonthExpense) / prevMonthExpense) * 100;
    if (delta > 10) {
      insights.push({
        level: 'warning',
        message: `Your spending increased by ${Math.round(delta)}% compared to last month.`,
      });
    } else if (delta < -10) {
      insights.push({
        level: 'positive',
        message: `Your spending decreased by ${Math.round(Math.abs(delta))}% compared to last month.`,
      });
    }
  }

  // Priority 3 — single category dominates monthly spend.
  if (insights.length < 3 && monthlyExpense > 0 && categoryExpenses.length > 0) {
    const top = categoryExpenses[0];
    const share = (Number(top.total) / monthlyExpense) * 100;
    if (share >= 30) {
      insights.push({
        level: 'info',
        message: `${top.category || 'Uncategorized'} is your highest spending category this month.`,
      });
    }
  }

  // Priority 4 — savings rate improved.
  if (insights.length < 3 && Number.isFinite(prevSavingsRate)
      && savingsRate - prevSavingsRate >= 5) {
    insights.push({
      level: 'positive',
      message: 'Your savings rate improved this month.',
    });
  }

  return insights.slice(0, 3);
};

const computeSavingsRate = (income, expense) => {
  if (!Number.isFinite(income) || income <= 0) return 0;
  return Math.round(((income - expense) / income) * 100);
};

const decorateUpcoming = (rows, today = todayISO()) => rows.map((r) => {
  const due = typeof r.next_due_date === 'string'
    ? r.next_due_date.slice(0, 10)
    : r.next_due_date.toISOString().slice(0, 10);
  const days = daysBetween(today, due);
  let status = 'upcoming';
  if (days < 0)       status = 'overdue';
  else if (days <= 3) status = 'due_soon';
  return {
    id: r.id,
    title: r.title,
    amount: Number(r.amount),
    type: r.type,
    frequency: r.frequency,
    next_due_date: due,
    days_until: days,
    status,
    category_id: r.category_id,
    category: r.category_name || null,
    wallet_id: r.wallet_id,
    wallet: r.wallet_name || null,
  };
});

const getDashboard = async (userId, monthArg, yearArg) => {
  const uid = validateUserId(userId);
  const now = new Date();
  const month = Number(monthArg) || (now.getMonth() + 1);
  const year  = Number(yearArg)  || now.getFullYear();
  if (!isValidMonth(month)) throw new ValidationError('Invalid month');
  if (!isValidYear(year))   throw new ValidationError('Invalid year');

  const range = monthRange(month, year);
  const prev  = previousMonth(month, year);
  const prevRange = monthRange(prev.month, prev.year);

  // Parallelize independent DB hits.
  const [
    lifetime,
    monthly,
    prevMonthly,
    categoryExpenses,
    trend,
    walletRows,
    budgets,
    upcomingRaw,
    recentRows,
  ] = await Promise.all([
    dashboardModel.getTotals(uid),
    dashboardModel.getMonthlyTotals(uid, range.startDate, range.endDate),
    dashboardModel.getMonthlyTotals(uid, prevRange.startDate, prevRange.endDate),
    dashboardModel.getCategoryExpenses(uid, range.startDate, range.endDate),
    dashboardModel.getMonthlyExpenseTrend(uid, 6),
    walletModel.getBalances(uid),
    budgetService.getBudgetStatus(uid, month, year).catch(() => []),
    recurringService.getUpcoming(uid, 5),
    transactionModel.getAll(uid, { limit: 5 }),
  ]);

  const walletInitial = walletRows.reduce(
    (s, w) => s + Number(w.initial_balance || 0), 0,
  );
  const lifetimeIncome  = Number(lifetime.income)  || 0;
  const lifetimeExpense = Number(lifetime.expense) || 0;
  const balance = round2(walletInitial + lifetimeIncome - lifetimeExpense);

  const monthlyIncome  = Number(monthly.income)  || 0;
  const monthlyExpense = Number(monthly.expense) || 0;
  const savingsRate    = computeSavingsRate(monthlyIncome, monthlyExpense);

  const prevIncome  = Number(prevMonthly.income)  || 0;
  const prevExpense = Number(prevMonthly.expense) || 0;
  const prevSavingsRate = computeSavingsRate(prevIncome, prevExpense);

  const categoryExpensesClean = categoryExpenses.map((c) => ({
    category_id: c.category_id,
    category:    c.category || 'Uncategorized',
    color:       c.color || '#7a766b',
    total:       Number(c.total) || 0,
  }));

  const monthlyTrend = trend.map((t) => ({
    period: t.period,
    year:   Number(t.year),
    month:  Number(t.month),
    total:  Number(t.total) || 0,
  }));

  const wallets = walletRows.map((w) => ({
    id: w.id,
    name: w.name,
    color: w.color,
    initial_balance: Number(w.initial_balance) || 0,
    income:  Number(w.income)  || 0,
    expense: Number(w.expense) || 0,
    balance: round2((Number(w.initial_balance) || 0)
      + (Number(w.income) || 0) - (Number(w.expense) || 0)),
  }));

  const upcomingPayments = decorateUpcoming(upcomingRaw);

  const recentTransactions = recentRows.map((t) => ({
    id: t.id,
    title: t.title,
    amount: Number(t.amount),
    type: t.type,
    date: typeof t.date === 'string' ? t.date.slice(0, 10) : t.date.toISOString().slice(0, 10),
    category_id: t.category_id,
    category: t.category_name || null,
    wallet_id: t.wallet_id,
    wallet: t.wallet_name || null,
    note: t.note,
  }));

  const insights = buildInsights({
    monthlyExpense,
    prevMonthExpense: prevExpense,
    categoryExpenses: categoryExpensesClean,
    budgets,
    savingsRate,
    prevSavingsRate,
  });

  return {
    month,
    year,
    balance,
    monthlyIncome:  round2(monthlyIncome),
    monthlyExpense: round2(monthlyExpense),
    savingsRate,
    insights,
    categoryExpenses: categoryExpensesClean,
    monthlyTrend,
    budgets,
    upcomingPayments,
    recentTransactions,
    wallets,
  };
};

module.exports = {
  getDashboard,
  _internals: { buildInsights, computeSavingsRate, decorateUpcoming },
};
