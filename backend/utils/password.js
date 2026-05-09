const bcrypt = require('bcryptjs');

const DEFAULT_COST = 12;

const cost = () => {
  const n = Number(process.env.BCRYPT_COST);
  if (Number.isInteger(n) && n >= 4 && n <= 15) return n;
  return DEFAULT_COST;
};

const hash = async (plain) => bcrypt.hash(plain, cost());

const compare = async (plain, hashed) => {
  if (typeof hashed !== 'string' || hashed.length === 0) return false;
  return bcrypt.compare(plain, hashed);
};

module.exports = { hash, compare };
