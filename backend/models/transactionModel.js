const db = require('./db');

const getAll = async (userId, filters = {}) => {
  let query = `
    SELECT t.*,
           c.name AS category_name,
           w.name AS wallet_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN wallets    w ON t.wallet_id   = w.id
    WHERE t.user_id = $1
  `;
  const params = [userId];
  let i = 2;

  if (filters.type)        { query += ` AND t.type = $${i++}`;        params.push(filters.type); }
  if (filters.category_id) { query += ` AND t.category_id = $${i++}`; params.push(filters.category_id); }
  if (filters.wallet_id)   { query += ` AND t.wallet_id = $${i++}`;   params.push(filters.wallet_id); }
  if (filters.startDate)   { query += ` AND t.date >= $${i++}`;       params.push(filters.startDate); }
  if (filters.endDate)     { query += ` AND t.date <= $${i++}`;       params.push(filters.endDate); }

  query += ' ORDER BY t.date DESC, t.id DESC';
  if (filters.limit) {
    query += ` LIMIT $${i++}`;
    params.push(filters.limit);
  }
  const result = await db.query(query, params);
  return result.rows;
};

const getById = async (id, userId) => {
  const result = await db.query(
    'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rows[0];
};

const create = async (userId, { title, amount, type, category_id, wallet_id, date, note }) => {
  const result = await db.query(
    `INSERT INTO transactions (user_id, title, amount, type, category_id, wallet_id, date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [userId, title, amount, type, category_id, wallet_id || null, date, note]
  );
  return result.rows[0];
};

const update = async (id, userId, { title, amount, type, category_id, wallet_id, date, note }) => {
  const result = await db.query(
    `UPDATE transactions
     SET title=$1, amount=$2, type=$3, category_id=$4, wallet_id=$5, date=$6, note=$7
     WHERE id=$8 AND user_id=$9 RETURNING *`,
    [title, amount, type, category_id, wallet_id || null, date, note, id, userId]
  );
  return result.rows[0];
};

const remove = async (id, userId) => {
  await db.query(
    'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
};

module.exports = { getAll, getById, create, update, remove };
