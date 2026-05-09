const db = require('./db');

const PUBLIC_FIELDS = 'id, email, display_name, created_at, updated_at';

const create = async ({ email, passwordHash, displayName }) => {
  const result = await db.query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING ${PUBLIC_FIELDS}`,
    [email, passwordHash, displayName || null]
  );
  return result.rows[0];
};

const findByEmail = async (email) => {
  const result = await db.query(
    'SELECT id, email, password_hash, display_name FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return result.rows[0];
};

const findById = async (id) => {
  const result = await db.query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

const existsByEmail = async (email) => {
  const result = await db.query(
    'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email]
  );
  return result.rowCount > 0;
};

module.exports = { create, findByEmail, findById, existsByEmail };
