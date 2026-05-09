# WalletLog — JWT Authentication Design

**Status:** Design (pre-implementation)
**Author:** Sertac Akalin
**Scope:** Add user accounts + JWT-based authentication and turn WalletLog from a single-tenant demo into a multi-tenant API where every user only sees their own data.

---

## 1. Goals & Non-Goals

### Goals
- Each person has an account (`email` + `password`).
- Login returns a short-lived **access token** (JWT) and a long-lived **refresh token**.
- Every protected endpoint requires a valid access token.
- Existing entities (`categories`, `transactions`, `budgets`) become **per-user**: a user can never read or mutate another user's rows.
- Refresh tokens can be **revoked** (logout, password change, theft response).
- Passwords are stored only as bcrypt hashes — never in plaintext, never in logs.
- Test coverage for every new service function (validation, happy path, edge cases) — keeps the course's 15% test grade.

### Non-Goals (out of scope for this iteration)
- OAuth / social login (Google, GitHub).
- Email verification flow.
- Password reset by email (no SMTP infra in scope).
- 2FA / TOTP.
- Role-based access control beyond "owner of the row". There is one role: `user`.

---

## 2. Architecture Overview

```
        ┌─────────────┐    POST /auth/register      ┌──────────────┐
        │  Frontend   │ ─────────────────────────▶  │              │
        │ (Vanilla JS)│ ◀──── 201 + tokens ──────── │              │
        │             │                              │              │
        │             │    POST /auth/login          │   Express    │
        │             │ ─────────────────────────▶  │   Backend    │
        │             │ ◀──── 200 + tokens ──────── │              │
        │             │                              │              │
        │             │    GET  /api/transactions    │  + JWT MW    │
        │             │    Authorization: Bearer ... │              │
        │             │ ─────────────────────────▶  │              │
        │             │ ◀──── 200 [user's rows] ──── │              │
        └─────────────┘                              └──────┬───────┘
                                                            │
                                                            ▼
                                                     ┌─────────────┐
                                                     │ PostgreSQL  │
                                                     │  + users    │
                                                     │  + refresh_ │
                                                     │    tokens   │
                                                     └─────────────┘
```

Layer responsibilities stay the same as today (`routes → services → models → db`). New layers added:

- `middleware/authMiddleware.js` — verifies access token, attaches `req.user`.
- `services/authService.js` — register, login, refresh, logout, password hashing, token issuing.
- `models/userModel.js` — user CRUD.
- `models/refreshTokenModel.js` — refresh token persistence + revocation.
- `utils/jwt.js` — sign / verify helpers (access + refresh).
- `utils/password.js` — bcrypt wrapper.

---

## 3. Database Schema Changes

### 3.1 New tables

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(72)  NOT NULL,           -- bcrypt output is 60 chars; 72 leaves headroom
  display_name  VARCHAR(80),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

CREATE TABLE refresh_tokens (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    CHAR(64) NOT NULL,               -- sha256 hex of the random token
  expires_at    TIMESTAMP NOT NULL,
  revoked_at    TIMESTAMP,                       -- NULL = active
  replaced_by   INTEGER REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent    VARCHAR(255),
  ip            VARCHAR(45),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user        ON refresh_tokens (user_id);
CREATE UNIQUE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
```

**Why `token_hash` and not the token itself?** If the DB ever leaks, an attacker still cannot use those rows to forge sessions. It's the same defensive posture as `password_hash`.

### 3.2 Existing tables — add `user_id`

```sql
ALTER TABLE categories
  ADD COLUMN user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE categories
  DROP CONSTRAINT categories_name_key;                   -- name was globally unique
ALTER TABLE categories
  ADD CONSTRAINT categories_user_name_unique UNIQUE (user_id, name);
CREATE INDEX idx_categories_user ON categories (user_id);

ALTER TABLE transactions
  ADD COLUMN user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX idx_transactions_user      ON transactions (user_id);
CREATE INDEX idx_transactions_user_date ON transactions (user_id, date DESC);

ALTER TABLE budgets
  ADD COLUMN user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE budgets
  DROP CONSTRAINT budgets_category_id_month_year_key;    -- old uniqueness was global
ALTER TABLE budgets
  ADD CONSTRAINT budgets_user_cat_month_year_unique
    UNIQUE (user_id, category_id, month, year);
CREATE INDEX idx_budgets_user ON budgets (user_id);
```

> **Migration note for existing demo data:** the current schema has rows with no owner. For the course submission we do a clean reset (`DROP DATABASE walletlog; CREATE DATABASE walletlog;` then re-run `schema.sql`). No production data exists yet, so a real backfill plan is unnecessary — but we still document it (see §9).

---

## 4. JWT Design

### 4.1 Two tokens, two jobs

| Token | Lifetime | Where it lives | What it carries |
|---|---|---|---|
| **Access token**  | **15 min** | Memory on the client (JS variable) | Identity claims for fast auth checks |
| **Refresh token** | **7 days** | `httpOnly`, `Secure`, `SameSite=Strict` cookie | Random opaque string — DB-validated |

**Why split them?** Access tokens are stateless (cheap to verify, no DB hit) but cannot be revoked before they expire — so we keep them short. Refresh tokens are long-lived but stored server-side, so they *can* be revoked instantly (logout, password change, breach response).

### 4.2 Access token — JWT structure

```json
{
  "header":  { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "sub": 42,                    // user id
    "email": "user@example.com",
    "iat": 1715000000,
    "exp": 1715000900,            // 15 min after iat
    "iss": "walletlog",
    "aud": "walletlog-api"
  }
}
```

- Signed with `JWT_ACCESS_SECRET` (≥ 32 bytes random, from `.env`).
- HS256 is fine here — single backend, no third-party verifier. RS256 only earns its keep when an external service must verify without holding the secret.
- We **do not** put password, refresh token, or any PII beyond email in the payload. Anyone with the token can `base64url`-decode the body.

### 4.3 Refresh token — opaque random string

- 32 bytes from `crypto.randomBytes(32)` → `base64url` (43 chars).
- Stored in DB as `sha256` hex hash, never in plaintext.
- Sent to the client as an `httpOnly` cookie (`refresh_token`) so JS cannot read it (XSS-safe).
- Rotated on every `/auth/refresh`: the old row is marked `revoked_at = NOW()`, `replaced_by = <new id>`, and a fresh token is issued. **Refresh-token reuse** (a token presented after it was already rotated) means the chain is compromised — we revoke the entire family for that user (see §6.4).

### 4.4 Configuration (`.env`)

```env
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>          # not used to sign — used as HMAC key for cookie integrity if needed
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
BCRYPT_COST=12
COOKIE_SECURE=false                                 # true in production over HTTPS
COOKIE_DOMAIN=                                      # leave blank for localhost
```

`.env.example` will ship with placeholders so a fresh clone has a one-step setup.

---

## 5. API Surface

### 5.1 New auth endpoints

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, displayName? }` | 201 `{ user, accessToken }` + Set-Cookie | Auto-login on register |
| POST | `/api/auth/login`    | `{ email, password }`                 | 200 `{ user, accessToken }` + Set-Cookie |  |
| POST | `/api/auth/refresh`  | — (cookie only)                       | 200 `{ accessToken }` + new Set-Cookie | Rotates refresh token |
| POST | `/api/auth/logout`   | — (cookie only)                       | 204 + Clear-Cookie | Revokes the refresh token |
| GET  | `/api/auth/me`       | — (Bearer)                            | 200 `{ user }` | Sanity check + frontend bootstrap |

### 5.2 Status code conventions (consistent with existing API)

| Outcome | Code |
|---|---|
| Successful auth | 200 (login/refresh/me), 201 (register), 204 (logout) |
| Validation error (bad email, weak password) | **400** |
| Wrong credentials | **401** (`{"error":"Invalid credentials"}`) — same message for "email not found" and "wrong password", to prevent user enumeration |
| Email already taken | **409** |
| Missing/invalid/expired access token | **401** |
| Authenticated but trying to touch another user's row | **404** (we hide existence — see §6.3) |
| Refresh token reuse / revoked | **401** + revoke entire token family |

### 5.3 Existing endpoints become protected

Every `/api/categories`, `/api/transactions`, `/api/budgets` route (all verbs) requires a valid Bearer access token. Without it: `401`.

Filtering and ownership are now enforced at the **service layer** — every query is scoped by `user_id = req.user.id`.

---

## 6. Authorization Rules

### 6.1 Always scope by `user_id`

The model layer accepts `userId` as a required argument. Example:

```js
// models/transactionModel.js  (after change)
async function findById(id, userId) {
  const { rows } = await db.query(
    'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] || null;
}
```

There is no model function that fetches a row without `user_id`. **Skipping the scope is the bug class we are designing out.**

### 6.2 Service-layer guard

Even when the model is called with a `user_id`, services double-check ownership before mutations:

```js
const row = await transactionModel.findById(id, userId);
if (!row) throw new NotFoundError('Transaction not found');
```

### 6.3 Hide existence: 404 over 403

If user A tries to `GET /api/transactions/<B's id>`, we respond **404 Not Found**, not **403 Forbidden**. Returning 403 leaks the fact that the row exists. 404 says "as far as you're concerned, it doesn't."

### 6.4 Refresh-token reuse detection

Each refresh token has an implicit "family" — the chain of `replaced_by` links. If a token is presented that has `revoked_at IS NOT NULL`, we revoke **every active token belonging to that user** and force a re-login. This is the standard OWASP mitigation against refresh-token theft.

---

## 7. Security Checklist

- [x] **Passwords**: bcrypt with cost 12. Never logged. Min 8 chars, max 72 (bcrypt limit), require at least one letter + one digit.
- [x] **Email**: lowercased on insert and on login lookup. Length capped at 254 (RFC 5321).
- [x] **Access token**: HS256, ≥ 32-byte secret, 15-min expiry, `iss`/`aud` checked on verify.
- [x] **Refresh token**: opaque, hashed at rest, rotated every refresh, revocation on logout/reuse.
- [x] **Cookies**: `httpOnly`, `Secure` (in prod), `SameSite=Strict`, path `/api/auth`.
- [x] **Rate limiting**: `/auth/login` and `/auth/register` get an `express-rate-limit` middleware — 10 req/min per IP. Stops naive brute force.
- [x] **Generic auth errors**: same message + 401 for unknown email vs wrong password.
- [x] **Timing-safe compare**: `bcrypt.compare` is timing-safe by design; no manual `===` on hashes.
- [x] **CORS**: tighten in prod to a known origin; for local dev keep open and document it.
- [x] **Helmet**: add `helmet()` middleware for sane default headers (XSS-Protection, NoSniff, Frame-Options).
- [x] **Input validation**: Zod (or hand-rolled in services to stay dep-light) for `email`, `password`, `displayName`. Rejects on first failure with 400 + field name.
- [x] **No secrets in git**: `.env` is already gitignored. `JWT_ACCESS_SECRET` is required at boot — server fails fast if missing.
- [x] **Cleanup job (optional)**: a tiny cron / on-startup query that deletes `refresh_tokens` where `expires_at < NOW() - INTERVAL '30 days'`.

---

## 8. File Structure (additions)

```
backend/
├── index.js                         (+ helmet, cookie-parser, /api/auth mount)
├── schema.sql                       (+ users, refresh_tokens, user_id columns)
├── middleware/
│   ├── errorHandler.js              (existing)
│   ├── authMiddleware.js            NEW — requireAuth
│   └── rateLimit.js                 NEW — auth route limiter
├── routes/
│   ├── authRoutes.js                NEW
│   ├── categoryRoutes.js            (+ requireAuth, pass req.user.id)
│   ├── transactionRoutes.js         (+ requireAuth)
│   └── budgetRoutes.js              (+ requireAuth)
├── services/
│   ├── authService.js               NEW
│   ├── categoryService.js           (every fn takes userId)
│   ├── transactionService.js        (every fn takes userId)
│   └── budgetService.js             (every fn takes userId)
├── models/
│   ├── userModel.js                 NEW
│   ├── refreshTokenModel.js         NEW
│   ├── categoryModel.js             (queries scoped by user_id)
│   ├── transactionModel.js          (queries scoped by user_id)
│   └── budgetModel.js               (queries scoped by user_id)
├── utils/
│   ├── dates.js                     (existing)
│   ├── jwt.js                       NEW — signAccess, verifyAccess
│   └── password.js                  NEW — hash, compare
├── tests/
│   ├── authService.test.js          NEW
│   ├── jwt.test.js                  NEW
│   ├── categoryService.test.js      (update to assert user-scoping)
│   ├── transactionService.test.js   (update to assert user-scoping)
│   └── budgetService.test.js        (update to assert user-scoping)
└── swagger.yaml                     (+ securitySchemes: bearerAuth, /auth/* paths)
```

---

## 9. Migration Plan

Two paths — pick one based on whether the DB has data we care about.

### Path A — Clean reset (recommended for the course)
```bash
psql -U postgres -c "DROP DATABASE IF EXISTS walletlog;"
psql -U postgres -c "CREATE DATABASE walletlog;"
psql -U postgres -d walletlog -f backend/schema.sql
```
Result: empty DB with the new auth-aware schema. Register a user via the UI to start.

### Path B — Preserve existing rows
1. `BEGIN;`
2. Create `users`, `refresh_tokens` tables (§3.1).
3. Insert a placeholder `users` row (`email='legacy@walletlog.local'`, password hash for a temporary password printed once to the operator).
4. `ALTER TABLE ... ADD COLUMN user_id INTEGER REFERENCES users(id);` (nullable for now).
5. `UPDATE` each table to assign `user_id = <legacy id>`.
6. `ALTER TABLE ... ALTER COLUMN user_id SET NOT NULL;`
7. Drop old global-uniqueness constraints, add per-user ones (§3.2).
8. `COMMIT;`

Path B will be documented but not executed for the course submission.

---

## 10. Frontend (Vanilla JS) Changes

The course locks us to vanilla JS, so no auth library — we do it by hand:

- **Login / Register screens**: two new views, gated above the existing dashboard. Tabbed UI in one HTML section to keep it inside the single-file SPA.
- **Token storage**:
  - Access token → in-memory variable inside the IIFE. Never `localStorage` (XSS-readable).
  - Refresh token → server-set `httpOnly` cookie. JS never touches it.
- **`api()` helper**: thin wrapper around `fetch` that:
  1. Adds `Authorization: Bearer <accessToken>`.
  2. Sends cookies (`credentials: 'include'`).
  3. On `401`, calls `POST /api/auth/refresh` once, retries the original request with the new access token, and on second `401` redirects to `/login`.
- **Boot sequence**: on page load, hit `GET /api/auth/me` with the cookie's refresh — if it succeeds (after a silent refresh), show the dashboard; otherwise show the login screen.
- **Logout**: `POST /api/auth/logout` → clear the in-memory token → render login.

---

## 11. Test Plan

Every new service function gets a Jest unit test. Targets that **must** pass before submission:

### `authService.test.js`
- `register`:
  - Hashes password (cost == 12).
  - Lowercases email before insert.
  - Throws `ValidationError` for weak password / bad email.
  - Throws `ConflictError` (409) when email already exists.
- `login`:
  - Returns user + access token + refresh token on valid credentials.
  - Throws 401 on wrong password (same message as unknown email).
  - Throws 401 on unknown email.
- `refresh`:
  - Rotates: old token is marked revoked, new token returned.
  - Reusing an already-revoked token revokes the entire family.
  - Expired token → 401.
- `logout`:
  - Marks the token revoked.
  - Idempotent on already-revoked tokens.

### `jwt.test.js`
- Sign+verify round-trip preserves `sub`, `email`, `iss`, `aud`.
- Tampered token → throws.
- Expired token → throws specific `TokenExpiredError`.
- Wrong audience → throws.

### Existing service tests — updates
- Every fixture now includes `userId`. Tests assert that:
  - Listing only returns the calling user's rows (mock returns mixed rows; service filters via the model's `userId` arg).
  - Fetching another user's id throws `NotFoundError`.
  - Updating/Deleting another user's id throws `NotFoundError`.

Coverage target: stay above ~85% on services. Today: 71 tests in 4 suites; after this change roughly **+25 tests in 6 suites**.

---

## 12. Dependencies (npm)

Add:
```
bcrypt              ^5.1.1     password hashing
jsonwebtoken        ^9.0.2     JWT sign/verify
cookie-parser       ^1.4.6     refresh-token cookie
express-rate-limit  ^7.4.0     brute-force defence
helmet              ^7.1.0     secure headers
zod                 ^3.23.8    input validation (or skip + hand-roll)
```
Dev:
```
supertest           ^7.0.0     HTTP-level integration tests for /auth
```

`bcrypt` builds a native binary — already on Node 20 macOS/Linux this is fine. If install fails on a target machine the fallback is `bcryptjs` (pure JS, ~3× slower at cost 12 — still acceptable for a personal-scale app).

---

## 13. Swagger Updates

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []      # default for all paths

paths:
  /api/auth/register: { post: { security: [] , ... } }    # explicitly public
  /api/auth/login:    { post: { security: [] , ... } }    # explicitly public
  /api/auth/refresh:  { post: { security: [] , ... } }    # uses cookie
  /api/auth/logout:   { post: { ... } }
  /api/auth/me:       { get:  { ... } }
```

The "Authorize" button in Swagger UI lets graders paste an access token and try every protected endpoint without leaving the docs page.

---

## 14. Implementation Tasks (no timeline — order only)

1. Schema: add `users`, `refresh_tokens`, add `user_id` to existing tables.
2. Utils: `password.js`, `jwt.js`.
3. Models: `userModel.js`, `refreshTokenModel.js`.
4. Service: `authService.js` (register, login, refresh, logout, me).
5. Middleware: `authMiddleware.js` (`requireAuth`), `rateLimit.js`.
6. Routes: `authRoutes.js` + mount in `index.js` + helmet + cookie-parser.
7. Update existing services + models + routes to scope by `userId`.
8. Update `swagger.yaml` (security schemes + auth paths + per-path requirement).
9. Write Jest tests for auth + update existing tests for user-scoping.
10. Frontend: add login/register screen, `api()` helper with refresh-on-401, gate the dashboard on `me`.
11. Update `README.md`: how to register a user, how to authorize in Swagger.
12. Run `npm run lint && npm test` — both green.
13. Manual click-through: register → login → CRUD → logout → second user cannot see first user's rows.

---

## 15. Definition of Done (for this iteration)

- [ ] `npm test` reports all suites passing, including ≥6 new auth tests.
- [ ] `npm run lint` is clean.
- [ ] `curl POST /api/auth/register` returns 201 + token; subsequent `GET /api/categories` with `Authorization: Bearer ...` returns `[]`.
- [ ] `GET /api/transactions` without a token returns 401.
- [ ] User A's transactions are invisible to User B (verified via two browser sessions).
- [ ] Logout invalidates the refresh cookie; `/auth/refresh` after logout returns 401.
- [ ] Swagger UI's "Authorize" works against every protected route.
- [ ] README has "How to authenticate" section + a sample `curl` flow.
- [ ] `.env.example` lists every new variable.
