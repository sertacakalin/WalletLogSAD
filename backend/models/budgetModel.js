const db = require('./db');

const getAll = async (userId) => {
  const result = await db.query(
    `SELECT b.*, c.name as category_name
     FROM budgets b
     LEFT JOIN categories c ON b.category_id = c.id
     WHERE b.user_id = $1
     ORDER BY b.year DESC, b.month DESC`,
    [userId]
  );
  return result.rows;
};

const getById = async (id, userId) => {
  const result = await db.query(
    'SELECT * FROM budgets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rows[0];
};

const create = async (userId, { category_id, month, year, limit_amount }) => {
  const result = await db.query(
    `INSERT INTO budgets (user_id, category_id, month, year, limit_amount)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, category_id, month, year, limit_amount]
  );
  return result.rows[0];
};

const update = async (id, userId, { limit_amount }) => {
  const result = await db.query(
    `UPDATE budgets SET limit_amount=$1
     WHERE id=$2 AND user_id=$3 RETURNING *`,
    [limit_amount, id, userId]
  );
  return result.rows[0];
};

const remove = async (id, userId) => {
  await db.query(
    'DELETE FROM budgets WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
};

module.exports = { getAll, getById, create, update, remove };
