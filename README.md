# WalletLog — Personal Expense Tracker

A full-stack web application that lets users register an account, record income
and expenses, group them by category, and set monthly budget limits with
overspend detection. Built for the **System Analysis & Design** course
(Spring 2026).

## Tech Stack

| Layer       | Choice                                  |
|-------------|-----------------------------------------|
| Frontend    | Vanilla JavaScript (SPA, no framework)  |
| Backend     | Node.js + Express                       |
| Database    | PostgreSQL                              |
| Auth        | JWT (HS256) + rotating refresh tokens   |
| API Docs    | Swagger / OpenAPI 3.0                   |
| Tests       | Jest                                    |
| Lint / CI   | ESLint + GitHub Actions                 |

## Architecture

```
walletlog/
├── backend/
│   ├── routes/         # thin HTTP handlers (no business logic)
│   ├── services/       # business logic + validation (unit-tested)
│   ├── models/         # parameterized SQL only
│   ├── middleware/     # auth, async + error handling, rate limit
│   ├── utils/          # dates, jwt, password, tokens
│   ├── tests/          # Jest unit tests for services
│   ├── errors.js       # typed error classes
│   ├── index.js        # Express app + Swagger mount
│   ├── swagger.yaml    # OpenAPI 3.0 spec
│   └── schema.sql      # database schema
├── frontend/
│   ├── index.html      # SPA shell (auth + dashboard + CRUD pages)
│   ├── styles.css      # styles (auth screen + app shell)
│   └── app.js          # logic (fetch + auto-refresh + render + validation)
├── .github/workflows/  # CI: lint + test on push
├── PROJECT_DESIGN.md   # full project design document
├── AUTH_DESIGN.md      # JWT auth deep-dive
└── README.md
```

The backend follows strict layering: **routes → services → models → db**.
Routes never contain business logic, services never touch SQL directly.
Every protected query is **scoped by `user_id`** so users only ever see their own data.

## Prerequisites

| Tool       | Version          |
|------------|------------------|
| Node.js    | 18 LTS or newer  |
| PostgreSQL | 14 or newer      |
| Git        | any modern       |

Verify your install:
```bash
node -v
psql --version
git --version
```

## Setup

### 1. Clone

```bash
git clone https://github.com/<your-username>/walletlog.git
cd walletlog
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Then generate a JWT secret and paste it into `.env`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The server **fails fast** at boot if `JWT_ACCESS_SECRET` is missing or shorter than 16 chars.

| Variable                 | What it does                                                         |
|--------------------------|----------------------------------------------------------------------|
| `DB_*`                   | PostgreSQL connection                                                |
| `PORT`                   | API port (default 3000)                                              |
| `CORS_ORIGIN`            | Frontend origin allow-list (blank = open, dev only)                  |
| `JWT_ACCESS_SECRET`      | **Required.** ≥ 32 byte random hex — signs access tokens             |
| `ACCESS_TOKEN_TTL`       | Access token lifetime (default `15m`)                                |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime in days (default `7`)                         |
| `BCRYPT_COST`            | bcrypt cost factor (default `12`; tests use `4` for speed)           |
| `COOKIE_SECURE`          | `true` in prod over HTTPS, `false` for localhost                     |

### 4. Create the database

```bash
psql -U postgres -c "CREATE DATABASE walletlog;"
psql -U postgres -d walletlog -f schema.sql
```

> The `schema.sql` script uses `DROP TABLE IF EXISTS` and recreates everything,
> so re-running it on an existing DB will reset all data.

### 5. Run the API

```bash
npm run dev          # nodemon, hot-reload (development)
# or
npm start            # plain node (production-style)
```

The server listens on `http://localhost:3000`. Visit
`http://localhost:3000/api-docs` for the interactive Swagger UI.

### 6. Open the app

The Express server also serves the frontend on the same origin, so a single
URL is all you need:

| URL | What's there |
|-----|--------------|
| **`http://localhost:3000`**           | The app — login screen, then dashboard |
| `http://localhost:3000/api-docs`      | Swagger UI (interactive API documentation) |
| `http://localhost:3000/api/*`         | Raw JSON API |
| `http://localhost:3000/health`        | Health probe |

Visit `http://localhost:3000`, register an account, and the dashboard takes
over — you'll never need to log in again until the refresh token expires.

## Authentication

Every endpoint under `/api/categories`, `/api/transactions`, `/api/budgets`
requires a Bearer access token. Three pieces work together:

1. **Access token** — JWT, 15 min, returned in the JSON body. The frontend
   stores it in memory only (never `localStorage`).
2. **Refresh token** — opaque, 7 days, set as an `httpOnly` cookie at
   `/api/auth`. JS cannot read it. Rotated on every refresh.
3. **Auto-refresh** — `app.js` retries any 401 once via
   `POST /api/auth/refresh` before bouncing the user to the login screen.

### Sample auth flow with curl

```bash
# 1. Register (auto-login)
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"deniz@example.com","password":"Sup3rSecret","displayName":"Deniz"}'

# 2. Login (sets the refresh cookie)
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"deniz@example.com","password":"Sup3rSecret"}'

# Grab the accessToken from the JSON response, then call protected endpoints:
TOKEN="<paste accessToken here>"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/categories

# 3. Refresh (rotates the cookie, returns a fresh access token)
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/refresh

# 4. Logout (revokes refresh + clears cookie)
curl -i -b cookies.txt -X POST http://localhost:3000/api/auth/logout
```

### Trying it from Swagger UI

1. Call `POST /auth/login` with your email and password.
2. Copy the `accessToken` from the response body.
3. Click the **Authorize** button (top right), paste the token, click Authorize.
4. Every protected endpoint is now callable from the docs page.

## API Reference

Full interactive documentation is at **`/api-docs`** (Swagger UI). Quick summary:

| Method | Path                          | Auth | Description                                   |
|--------|-------------------------------|------|-----------------------------------------------|
| POST   | `/api/auth/register`          | —    | Create account, auto-login                    |
| POST   | `/api/auth/login`             | —    | Exchange credentials for tokens               |
| POST   | `/api/auth/refresh`           | —    | Rotate refresh, return a new access token     |
| POST   | `/api/auth/logout`            | —    | Revoke refresh, clear cookie                  |
| GET    | `/api/auth/me`                | ✓    | Current user                                  |
| GET    | `/api/categories`             | ✓    | List the user's categories                    |
| POST   | `/api/categories`             | ✓    | Create a category                             |
| GET    | `/api/categories/:id`         | ✓    | Get one                                       |
| PUT    | `/api/categories/:id`         | ✓    | Update                                        |
| DELETE | `/api/categories/:id`         | ✓    | Delete                                        |
| GET    | `/api/transactions`           | ✓    | List (filter `type`, `category_id`, dates)    |
| POST   | `/api/transactions`           | ✓    | Create                                        |
| GET    | `/api/transactions/:id`       | ✓    | Get one                                       |
| PUT    | `/api/transactions/:id`       | ✓    | Update                                        |
| DELETE | `/api/transactions/:id`       | ✓    | Delete                                        |
| GET    | `/api/transactions/summary`   | ✓    | Monthly income / expense / balance            |
| GET    | `/api/budgets`                | ✓    | List budgets                                  |
| POST   | `/api/budgets`                | ✓    | Create                                        |
| GET    | `/api/budgets/:id`            | ✓    | Get one                                       |
| PUT    | `/api/budgets/:id`            | ✓    | Update limit                                  |
| DELETE | `/api/budgets/:id`            | ✓    | Delete                                        |
| GET    | `/api/budgets/status`         | ✓    | Spent / remaining / exceeded per category     |

### HTTP status codes

| Code | When                              |
|------|-----------------------------------|
| 200  | Successful read or update         |
| 201  | Resource created                  |
| 204  | Resource deleted (no body)        |
| 400  | Validation error                  |
| 401  | Not authenticated, or bad/expired token, or wrong credentials |
| 404  | Resource not found (also returned when another user owns it) |
| 409  | Unique constraint or conflict     |
| 429  | Rate limit hit on `/api/auth/*`   |
| 500  | Unexpected server error           |

## Testing

```bash
cd backend
npm test
```

Runs all Jest unit tests for the service layer (validation, business logic,
month-range edges, auth, JWT, password hashing). The model and DB layers are
mocked, so the database is **not** required to run tests.

## Linting

```bash
npm run lint
```

ESLint runs the same rules used in CI (`eslint:recommended` + project rules).

## Continuous Integration

Every push and pull request to `main` triggers `.github/workflows/ci.yml`:

1. Install dependencies (`npm ci`)
2. Run ESLint (`npm run lint`)
3. Run tests (`npm test`)

A green badge means the codebase is lint-clean and all unit tests pass.

## Validation

Validation runs on **both** sides:

- **Frontend** — per-field checks before submitting (required, length, hex
  color, ISO-date, positive amount, email format, password strength), with
  inline error messages and a toast for server-side failures.
- **Backend** — every service rejects with a typed `ValidationError` (400),
  `UnauthorizedError` (401), `NotFoundError` (404), or `ConflictError` (409);
  the central error middleware maps these to the correct HTTP status code.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `FATAL: JWT_ACCESS_SECRET must be set` | Add a 32-byte hex value to `.env` (see step 3 above). |
| `ECONNREFUSED ::1:5432` | Postgres is not running. Start it (`brew services start postgresql` on macOS) or check the port. |
| `password authentication failed` | Wrong credentials in `.env` — verify `DB_USER` and `DB_PASSWORD`. |
| Frontend gets `Failed to fetch` | API isn't running on `:3000`, or you opened the wrong page. Make sure `npm run dev` is up. |
| Login works once but app reloads → back to login screen | Cookie was blocked (cross-origin). Open the frontend on the same origin (or via `npx serve`) so the browser keeps the `httpOnly` cookie. |
| `npm test` hangs forever on macOS | The project path contains non-ASCII characters or spaces. Move it to an ASCII path (e.g. `~/Desktop/walletlog`). |
| `429 Too many requests` on login | Rate limiter triggered: 10 req/min/IP on `/api/auth/*`. Wait a minute. |
| Swagger UI page is blank | Make sure `swagger.yaml` is in the `backend/` folder and the server restarted. |

## Project Status

| Requirement                       | Status |
|-----------------------------------|--------|
| CRUD for all 3 entities           | Done   |
| User accounts (JWT + refresh)     | Done   |
| Per-user data isolation           | Done   |
| Filtering & relationships         | Done   |
| Frontend + backend validation     | Done   |
| Swagger UI with Bearer auth       | Done   |
| Jest tests for services           | Done   |
| GitHub Actions CI                 | Done   |
| README + reproducible setup       | Done   |

## License

ISC.
