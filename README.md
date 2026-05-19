# WalletLog

Personal expense tracker. Users register an account, record income/expense
transactions, group them by category, manage wallets, and set monthly
budgets. Built for the **System Analysis & Design** course (Spring 2026).

## Tech

- **Frontend** — Vanilla JavaScript SPA (no framework)
- **Backend** — Node.js + Express
- **Database** — PostgreSQL
- **Auth** — JWT (HS256) + rotating refresh tokens
- **Docs** — Swagger UI at `/api-docs`
- **Tests** — Jest (service layer)

## Layout

```
walletlog/
├── backend/
│   ├── routes/       HTTP handlers (no business logic)
│   ├── services/     business logic + validation (tested)
│   ├── models/       parameterized SQL
│   ├── middleware/   auth, error handler, rate limit
│   ├── tests/        Jest unit tests
│   ├── index.js      Express app
│   ├── swagger.yaml  OpenAPI 3.0 spec
│   └── schema.sql    database schema
└── frontend/         index.html + styles.css + app.js
```

Routes → services → models → db. Every protected query is scoped by `user_id`.

## Setup

Requires Node 18+ and PostgreSQL 14+.

```bash
git clone https://github.com/sertacakalin/WalletLogSAD.git walletlog
cd walletlog/backend
npm install
cp .env.example .env
```

Generate a JWT secret and paste it into `.env` as `JWT_ACCESS_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create the database:

```bash
psql -U postgres -c "CREATE DATABASE walletlog;"
psql -U postgres -d walletlog -f schema.sql
```

Run:

```bash
npm run dev
```

Open `http://localhost:3000` — login screen, then the dashboard.

## API

Interactive docs: **`http://localhost:3000/api-docs`**

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| POST | `/api/auth/refresh` | cookie |
| POST | `/api/auth/logout` | cookie |
| GET | `/api/auth/me` | Bearer |
| CRUD | `/api/categories` | Bearer |
| CRUD | `/api/transactions` (+ `/summary`) | Bearer |
| CRUD | `/api/budgets` (+ `/status`) | Bearer |
| CRUD | `/api/wallets` | Bearer |
| CRUD | `/api/recurring` | Bearer |
| GET | `/api/dashboard` | Bearer |

Protected endpoints expect `Authorization: Bearer <accessToken>`.
In Swagger UI: login, copy `accessToken`, click **Authorize**, paste.

## Tests

```bash
npm test
```

156 Jest tests on the service layer. Models are mocked, no DB needed.

## Lint

```bash
npm run lint
```

ESLint runs on every push via GitHub Actions (`.github/workflows/ci.yml`).

## Notes

- **Do not place this project inside `~/Desktop` or `~/Documents`** — those
  are iCloud-synced on macOS and `node_modules` files get evicted, which
  makes `node`/`jest` hang silently. Keep it at `~/walletlog`.
- Rate limit on `/api/auth/*`: 10 req/min/IP.
- The server fails to boot if `JWT_ACCESS_SECRET` is missing or shorter
  than 16 characters.

## License

ISC.
