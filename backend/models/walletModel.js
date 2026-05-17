const db = require('./db');

const PUBLIC_FIELDS = 'id, user_id, name, color, initial_balance, created_at';

const getAll = async (userId) => {
  const result = await db.query(
    `SELECT ${PUBLIC_FIELDS} FROM wallets
     WHERE user_id = $1
     ORDER BY name ASC`,
    [userId]
  );
  return result.rows;
};

const getById = async (id, userId) => {
  const result = await db.query(
    `SELECT ${PUBLIC_FIELDS} FROM wallets WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0];
};

const create = async (userId, { name, color, initial_balance }) => {
  const result = await db.query(
    `INSERT INTO wallets (user_id, name, color, initial_balance)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_FIELDS}`,
    [userId, name, color || '#3a3733', initial_balance || 0]
  );
  return result.rows[0];
};

const update = async (id, userId, { name, color, initial_balance }) => {
  const result = await db.query(
    `UPDATE wallets SET name = $1, color = $2, initial_balance = $3
     WHERE id = $4 AND user_id = $5
     RETURNING ${PUBLIC_FIELDS}`,
    [name, color, initial_balance, id, userId]
  );
  return result.rows[0];
};

const remove = async (id, userId) => {
  await db.query(
    'DELETE FROM wallets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
};

const getBalances = async (userId) => {
  // Per-wallet balance = initial_balance + SUM(income) - SUM(expense)
  // Transactions with NULL wallet_id are returned in a synthetic row (id = NULL).
  const result = await db.query(
    `SELECT
       w.id, w.name, w.color, w.initial_balance,
       COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) AS expense
     FROM wallets w
     LEFT JOIN transactions t
       ON t.wallet_id = w.id AND t.user_id = w.user_id
     WHERE w.user_id = $1
     GROUP BY w.id, w.name, w.color, w.initial_balance
     ORDER BY w.name ASC`,
    [userId]
  );
  return result.rows;
};

module.exports = { getAll, getById, create, update, remove, getBalances };
