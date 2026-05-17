const db = require('./db');

const PUBLIC_FIELDS = `r.id, r.user_id, r.wallet_id, r.category_id, r.title,
                       r.amount, r.type, r.frequency, r.next_due_date,
                       r.is_active, r.note, r.created_at`;

const getAll = async (userId) => {
  const result = await db.query(
    `SELECT ${PUBLIC_FIELDS},
            c.name AS category_name,
            w.name AS wallet_name
     FROM recurring_transactions r
     LEFT JOIN categories c ON r.category_id = c.id
     LEFT JOIN wallets    w ON r.wallet_id   = w.id
     WHERE r.user_id = $1
     ORDER BY r.next_due_date ASC`,
    [userId]
  );
  return result.rows;
};

const getById = async (id, userId) => {
  const result = await db.query(
    `SELECT ${PUBLIC_FIELDS}
     FROM recurring_transactions r
     WHERE r.id = $1 AND r.user_id = $2`,
    [id, userId]
  );
  return result.rows[0];
};

const getUpcoming = async (userId, limit = 5) => {
  const result = await db.query(
    `SELECT ${PUBLIC_FIELDS},
            c.name AS category_name,
            w.name AS wallet_name
     FROM recurring_transactions r
     LEFT JOIN categories c ON r.category_id = c.id
     LEFT JOIN wallets    w ON r.wallet_id   = w.id
     WHERE r.user_id = $1 AND r.is_active = TRUE
     ORDER BY r.next_due_date ASC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};

const create = async (userId, {
  title, amount, type, frequency, next_due_date,
  category_id, wallet_id, note, is_active,
}) => {
  const result = await db.query(
    `INSERT INTO recurring_transactions
       (user_id, wallet_id, category_id, title, amount, type, frequency,
        next_due_date, is_active, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${PUBLIC_FIELDS}`.replace(/r\./g, ''),
    [userId, wallet_id || null, category_id || null, title, amount, type,
     frequency, next_due_date, is_active !== false, note || null]
  );
  return result.rows[0];
};

const update = async (id, userId, {
  title, amount, type, frequency, next_due_date,
  category_id, wallet_id, note, is_active,
}) => {
  const result = await db.query(
    `UPDATE recurring_transactions
     SET title = $1, amount = $2, type = $3, frequency = $4,
         next_due_date = $5, category_id = $6, wallet_id = $7,
         note = $8, is_active = $9
     WHERE id = $10 AND user_id = $11
     RETURNING ${PUBLIC_FIELDS}`.replace(/r\./g, ''),
    [title, amount, type, frequency, next_due_date,
     category_id || null, wallet_id || null, note || null,
     is_active !== false, id, userId]
  );
  return result.rows[0];
};

const remove = async (id, userId) => {
  await db.query(
    'DELETE FROM recurring_transactions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
};

module.exports = { getAll, getById, getUpcoming, create, update, remove };
