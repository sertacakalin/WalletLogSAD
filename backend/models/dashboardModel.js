const db = require('./db');

// Lifetime income / expense across all of the user's transactions.
// Used to compute the "Total Balance" card together with wallet initial balances.
const getTotals = async (userId) => {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
     FROM transactions
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
};

// Income/expense totals for a single month (inclusive date range).
const getMonthlyTotals = async (userId, startDate, endDate) => {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
     FROM transactions
     WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
    [userId, startDate, endDate]
  );
  return result.rows[0];
};

// Expense distribution by category for a single month — drives the donut chart.
const getCategoryExpenses = async (userId, startDate, endDate) => {
  const result = await db.query(
    `SELECT
       c.id            AS category_id,
       c.name          AS category,
       c.color         AS color,
       COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.date BETWEEN $2 AND $3
     GROUP BY c.id, c.name, c.color
     HAVING COALESCE(SUM(t.amount), 0) > 0
     ORDER BY total DESC`,
    [userId, startDate, endDate]
  );
  return result.rows;
};

// Last N months of expense totals — drives the line chart.
// Returns one row per (year, month) including months with zero spend within range.
const getMonthlyExpenseTrend = async (userId, months) => {
  const result = await db.query(
    `WITH months AS (
       SELECT date_trunc('month', NOW())::date - (INTERVAL '1 month' * gs) AS month_start
       FROM generate_series(0, $2::int - 1) AS gs
     )
     SELECT
       to_char(m.month_start, 'YYYY-MM') AS period,
       EXTRACT(YEAR  FROM m.month_start)::int AS year,
       EXTRACT(MONTH FROM m.month_start)::int AS month,
       COALESCE(SUM(t.amount), 0) AS total
     FROM months m
     LEFT JOIN transactions t
       ON t.user_id = $1
      AND t.type = 'expense'
      AND date_trunc('month', t.date) = m.month_start
     GROUP BY m.month_start
     ORDER BY m.month_start ASC`,
    [userId, months]
  );
  return result.rows;
};

module.exports = {
  getTotals,
  getMonthlyTotals,
  getCategoryExpenses,
  getMonthlyExpenseTrend,
};
