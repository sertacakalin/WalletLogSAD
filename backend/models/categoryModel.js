const db = require('./db');

const getAll = async (userId) => {
  const result = await db.query(
    'SELECT * FROM categories WHERE user_id = $1 ORDER BY id',
    [userId]
  );
  return result.rows;
};

const getById = async (id, userId) => {
  const result = await db.query(
    'SELECT * FROM categories WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rows[0];
};

const create = async (userId, name, color) => {
  const result = await db.query(
    `INSERT INTO categories (user_id, name, color)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, name, color]
  );
  return result.rows[0];
};

const update = async (id, userId, name, color) => {
  const result = await db.query(
    `UPDATE categories SET name=$1, color=$2
     WHERE id=$3 AND user_id=$4 RETURNING *`,
    [name, color, id, userId]
  );
  return result.rows[0];
};

const remove = async (id, userId) => {
  await db.query(
    'DELETE FROM categories WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
};

module.exports = { getAll, getById, create, update, remove };
