-- WalletLog Database Schema (auth-aware, multi-tenant)
-- Run inside psql after: CREATE DATABASE walletlog; \c walletlog
-- Drop everything first if you are recreating from scratch.

DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS budgets        CASCADE;
DROP TABLE IF EXISTS transactions   CASCADE;
DROP TABLE IF EXISTS categories     CASCADE;
DROP TABLE IF EXISTS users          CASCADE;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(72)  NOT NULL,
  display_name  VARCHAR(80),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

CREATE TABLE refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  revoked_at  TIMESTAMP,
  replaced_by INTEGER REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent  VARCHAR(255),
  ip          VARCHAR(45),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX        idx_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7) DEFAULT '#cccccc',
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT categories_user_name_unique UNIQUE (user_id, name)
);
CREATE INDEX idx_categories_user ON categories (user_id);

CREATE TABLE transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  amount      NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  type        VARCHAR(10)    NOT NULL CHECK (type IN ('income', 'expense')),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_transactions_user      ON transactions (user_id);
CREATE INDEX idx_transactions_user_date ON transactions (user_id, date DESC);

CREATE TABLE budgets (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INTEGER NOT NULL,
  limit_amount NUMERIC(10, 2) NOT NULL CHECK (limit_amount >= 0),
  CONSTRAINT budgets_user_cat_month_year_unique UNIQUE (user_id, category_id, month, year)
);
CREATE INDEX idx_budgets_user ON budgets (user_id);
