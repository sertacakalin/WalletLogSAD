const db = require('./db');

const create = async ({ userId, tokenHash, expiresAt, userAgent, ip }) => {
  const result = await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, token_hash, expires_at, revoked_at, replaced_by, created_at`,
    [userId, tokenHash, expiresAt, userAgent || null, ip || null]
  );
  return result.rows[0];
};

const findByHash = async (tokenHash) => {
  const result = await db.query(
    `SELECT id, user_id, token_hash, expires_at, revoked_at, replaced_by, created_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0];
};

const revoke = async (id, replacedBy = null) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(), replaced_by = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [id, replacedBy]
  );
};

const revokeAllForUser = async (userId) => {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
};

const deleteExpired = async () => {
  await db.query(
    `DELETE FROM refresh_tokens
     WHERE expires_at < NOW() - INTERVAL '30 days'`
  );
};

module.exports = {
  create,
  findByHash,
  revoke,
  revokeAllForUser,
  deleteExpired,
};
