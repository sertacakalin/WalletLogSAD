# WalletLog — Project Design Document

**Status:** Living design (will be updated as the build progresses)
**Author:** Sertac Akalin
**Course:** System Analysis & Design — Spring 2026, Istanbul Arel University
**Companion docs:** `CLAUDE.md` (rules) · `AUTH_DESIGN.md` (auth deep-dive) · `STATUS.md` (build state) · `README.md` (run-it instructions)

---

## 1. One-Sentence Description

WalletLog is a small, single-page web app where a person registers an account, records every income and expense they have, organises those entries by category, and sets per-category monthly budget limits — and immediately sees, on a dashboard, where they stand for the month.

That one sentence is the entire product.

---

## 2. Problem & Why It Exists

Most people who try to track money fall off after a week. The cause is almost never lack of motivation — it is friction:

- Spreadsheet apps are too generic; you spend more time formatting than tracking.
- Bank dashboards only show what the bank sees, not your splits or your intent.
- Mobile apps are usually bloated with features, ads, and forced cloud syncs.

WalletLog answers a smaller, sharper question: **"Did I stay inside my plan this month?"**
Three nouns, one verb. Categories, transactions, budgets — and a number that says *yes* or *no, by how much*.

This focus is also what makes the app a clean fit for the System Analysis & Design course: a data-centric domain with three related entities, four CRUD verbs each, real validation rules, and at least one non-trivial computed view (the dashboard).

---

## 3. Target User

A single persona, kept deliberately narrow:

> **"Deniz"** — a 22-year-old university student. Earns from a part-time job and a small monthly transfer from family. Wants to know whether they overspend on food, transport, and going out, and to set a cap they actually stick to. Has a laptop, opens it once a week to enter a stack of receipts and check the dashboard.

Everything in the design is filtered through Deniz: if a feature does not help Deniz answer "am I on track this month?", it is not in scope.

---

## 4. Scope

### 4.1 In scope

- Account: register, login, logout — every user only sees their own data.
- Categories: create, rename, recolour, delete — each owned by the logged-in user.
- Transactions: income and expense entries, each optionally linked to a category, with a date, amount, title and free-text note.
- Budgets: a monthly spending cap per category (one budget row per `(user, category, month, year)`).
- Dashboard:
  - Total income / total expense / balance for a chosen month.
  - Per-category status: limit, spent, remaining, percent used, and an "exceeded" flag when spent > limit.
- Filtering on transactions: by type, by category, by date range.
- Interactive Swagger UI documenting every endpoint.
- Authentication via JWT (short-lived access token + rotating refresh token in an httpOnly cookie).
- Form validation on **both** the frontend and the backend.
- Unit tests on the service layer.
- Continuous integration (lint + tests on every push).

### 4.2 Out of scope (intentionally)

- Multi-currency support (single currency, formatted client-side).
- Recurring transactions / scheduled rules.
- Bank or open-banking integration.
- File / receipt attachments.
- Mobile app, push notifications, email reminders.
- OAuth social login, email verification, password reset by email.
- Roles, sharing, group budgets.
- Cloud deployment automation.

These are listed so it is clear they were considered and *deliberately* excluded — not forgotten.

---

## 5. Core User Stories

| # | As a... | I want... | so that... |
|---|---|---|---|
| 1 | new visitor | to register with an email and password | I have my own private space. |
| 2 | returning user | to log in and stay logged in for a session | I don't re-enter my password every minute. |
| 3 | user | to log out from any device | I leave a shared computer safely. |
| 4 | user | to create / rename / recolour / delete categories | I can shape buckets that match my life. |
| 5 | user | to record an income or expense in seconds | I actually do it instead of skipping it. |
| 6 | user | to filter transactions by type, category and date range | I can focus on one slice at a time. |
| 7 | user | to set a monthly limit per category | I have a target, not just a record. |
| 8 | user | to see, at a glance, where I'm overspending this month | I can correct course before the month ends. |
| 9 | user | to be sure another user can never see my numbers | the data feels personal and safe. |
| 10 | grader | to try every endpoint from a single docs page | the assessment is friction-free. |

---

## 6. Domain Model

Four entities. The new addition vs. the existing demo schema is `users`; everything else gains a `user_id` foreign key (multi-tenant cut).

```
┌────────────┐ 1   N ┌──────────────┐ N   1 ┌──────────────┐
│   users    │───────│ transactions │───────│ categories   │
│ id (PK)    │       │ id (PK)      │       │ id (PK)      │
│ email UQ   │       │ user_id FK   │       │ user_id FK   │
│ pw_hash    │       │ category_id  │       │ name         │
│ display    │       │ title        │       │ color        │
└─────┬──────┘       │ amount       │       └──────┬───────┘
      │ 1            │ type (in/ex) │              │ 1
      │              │ date         │              │
      │ N            │ note         │              │ N
┌─────┴──────────┐   └──────────────┘     ┌────────┴────────┐
│ refresh_tokens │                         │     budgets     │
│ id (PK)        │                         │ id (PK)         │
│ user_id FK     │                         │ user_id FK      │
│ token_hash     │                         │ category_id FK  │
│ expires_at     │                         │ month, year     │
│ revoked_at     │                         │ limit_amount    │
│ replaced_by    │                         │ UQ(u,c,m,y)     │
└────────────────┘                         └─────────────────┘
```

Key rules:

- `users.email` is unique (case-insensitive).
- `categories.name` is unique **per user**, not globally.
- A `transaction` must belong to a user; `category_id` is optional (you can record a transaction without categorising it).
- A `budget` is uniquely identified by `(user_id, category_id, month, year)` — one cap per category per month.
- Deleting a user cascades into their tokens, categories, transactions, and budgets.

---

## 7. System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          Frontend                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ index.html  (single page, hash routing-free SPA)       │    │
│  │  ├── Auth view  (login / register)                     │    │
│  │  └── App view   (categories | transactions | budgets   │    │
│  │                  | dashboard)                          │    │
│  │                                                        │    │
│  │  app.js   ── api() helper (fetch + auto-refresh)       │    │
│  │  styles.css                                            │    │
│  └────────────────────────────────────────────────────────┘    │
│                       │  HTTPS · Bearer JWT  · cookie          │
└───────────────────────┼────────────────────────────────────────┘
                        ▼
┌────────────────────────────────────────────────────────────────┐
│                       Backend (Express)                        │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │   routes/    │ → │   services/  │ → │     models/      │    │
│  │ thin handler │   │ business +   │   │ parameterized    │    │
│  │ no logic     │   │ validation   │   │ SQL only         │    │
│  └──────────────┘   └──────────────┘   └────────┬─────────┘    │
│       ▲                    ▲                    │              │
│       │ auth middleware    │ typed errors       │              │
│  cookie-parser, helmet,    │ (400/404/409)      │              │
│  rate-limit, JSON body     │                    │              │
│                                                  │              │
│  /api-docs  →  swagger-ui-express + swagger.yaml │              │
└──────────────────────────────────────────────────┼─────────────┘
                                                   ▼
                                        ┌────────────────────┐
                                        │     PostgreSQL     │
                                        │ users · refresh_   │
                                        │ tokens · cats ·    │
                                        │ tx · budgets       │
                                        └────────────────────┘
```

The backend is **strictly layered**:

- **Routes** parse the HTTP request, call one service function, and return JSON + a status code. They have no `if`s about business rules.
- **Services** own validation, business logic, and the only place we throw typed errors.
- **Models** issue parameterized SQL. They never decide anything.
- **Middleware** handles cross-cutting concerns: parsing JSON, parsing cookies, applying security headers, requiring auth, rate-limiting auth endpoints, and turning thrown errors into HTTP responses.

This layering is the same shape the course rubric rewards (and the same shape that lets us unit-test services with the model layer mocked).

---

## 8. Tech Stack & Rationale

| Layer | Choice | Why this, not something else |
|---|---|---|
| Frontend | Vanilla JS, single-file SPA | Course rule. Forces us to understand `fetch`, DOM, validation, state — no framework safety net. |
| Backend | Node.js + Express 4 | Course rule. Minimal surface area, well-known middleware ecosystem. |
| Database | PostgreSQL 14+ | Free, transactional, expressive constraints (CHECK, UNIQUE composite, partial indexes). SQLite would have hidden the multi-user complexity; Mongo would have under-modelled the relationships. |
| Password hashing | bcrypt (cost 12) | Battle-tested, slow on purpose, automatic salting. Argon2id is theoretically nicer but bcrypt is the safer dependency choice for a graded project. |
| Auth | JWT (HS256) + opaque refresh token | See `AUTH_DESIGN.md`. Short-lived access JWT for stateless verification, server-side refresh for revocability. |
| Validation | Zod (or hand-rolled) | Either works; service-layer guards either way. Zod gives clearer error shapes; hand-rolled keeps deps lean. |
| Security headers | helmet | Sane defaults — CSP, NoSniff, Frame-Options, HSTS. One middleware call. |
| Rate limit | express-rate-limit | One sliding-window limiter on `/auth/*`. Stops naive credential stuffing. |
| API docs | swagger-ui-express + YAML | Required by the course; the Authorize button gives graders a one-click experience for protected endpoints. |
| Tests | Jest + supertest | Jest for service-level units (mocked DB); supertest for `/auth` integration paths. |
| Lint | ESLint (`eslint:recommended`) | Course bonus + catches dumb stuff before review. |
| CI | GitHub Actions | One workflow: install → lint → test on every push. |

---

## 9. API Surface

All endpoints return JSON (`Content-Type: application/json`) and follow the same status-code map.

### 9.1 Public (no auth)
```
POST  /api/auth/register     create account, auto-login        201
POST  /api/auth/login        exchange creds for tokens         200
POST  /api/auth/refresh      rotate refresh + new access       200
POST  /api/auth/logout       revoke refresh token              204
```

### 9.2 Authenticated (Bearer access token)
```
GET   /api/auth/me                                              200

GET   /api/categories                                           200
POST  /api/categories                                           201
GET   /api/categories/:id                                       200 / 404
PUT   /api/categories/:id                                       200 / 400 / 404
DELETE /api/categories/:id                                      204 / 404

GET   /api/transactions       ?type=&category_id=&from=&to=     200
POST  /api/transactions                                         201
GET   /api/transactions/:id                                     200 / 404
PUT   /api/transactions/:id                                     200 / 400 / 404
DELETE /api/transactions/:id                                    204 / 404
GET   /api/transactions/summary  ?month=&year=                  200

GET   /api/budgets             ?month=&year=                    200
POST  /api/budgets                                              201
GET   /api/budgets/:id                                          200 / 404
PUT   /api/budgets/:id                                          200 / 400 / 404
DELETE /api/budgets/:id                                         204 / 404
GET   /api/budgets/status      ?month=&year=                    200
```

### 9.3 Status code conventions

| Code | Meaning | Examples |
|---|---|---|
| 200 | Successful read or update | GET list, GET one, PUT |
| 201 | Resource created | POST register, POST any entity |
| 204 | Successful delete / logout | no body |
| 400 | Validation error | bad email, weak password, negative amount |
| 401 | Not authenticated / bad credentials | missing/expired token, wrong password |
| 404 | Not found (or hidden ownership) | unknown id, **another user's id** |
| 409 | Conflict | email already registered, duplicate `(user, name)` category |
| 500 | Server error | uncaught exception |

### 9.4 Authorization rule

Every protected query is filtered by `user_id = req.user.id` at the model layer. Trying to access another user's row returns **404, not 403**, to avoid leaking the existence of other users' data. This is documented in `AUTH_DESIGN.md` §6.

---

## 10. UX Walkthrough

The whole frontend is a single `index.html` with three logical screens, swapped by show/hide:

### 10.1 Auth screen (visible while logged out)
```
┌────────────────────────────────────────────┐
│            WalletLog                       │
│   ┌──────────────┐  ┌────────────────┐     │
│   │  Login (•)   │  │  Register      │     │
│   └──────────────┘  └────────────────┘     │
│                                            │
│   email      [____________________]        │
│   password   [____________________]        │
│   [Sign in]                                │
│                                            │
│   ─ inline errors under each field ─       │
└────────────────────────────────────────────┘
```

### 10.2 App shell (after login)
```
┌─────────────────────────────────────────────────────────────┐
│ WalletLog            user@email   May 2026 ▼      [Logout] │
├─────────────────────────────────────────────────────────────┤
│  Dashboard | Transactions | Categories | Budgets           │
├─────────────────────────────────────────────────────────────┤
│   Income    9 200   ▲                                      │
│   Expense   6 480   ▼     Balance  +2 720                  │
│                                                             │
│   Per-category status                                      │
│   ┌───────────┬────────┬────────┬─────────┬─────────┐      │
│   │ Category  │ Limit  │ Spent  │ Remain  │ State   │      │
│   ├───────────┼────────┼────────┼─────────┼─────────┤      │
│   │ Food      │  2 000 │  2 350 │   -350  │ OVER ⚠ │      │
│   │ Transport │    700 │    420 │    280  │ OK     │      │
│   │ Fun       │    500 │    500 │      0  │ AT CAP │      │
│   └───────────┴────────┴────────┴─────────┴─────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 10.3 Transactions screen
- Filters at the top: type (`all/income/expense`), category, from-date, to-date, **Clear** button.
- "Add transaction" form inline; toggles to "Edit" mode when a row's pencil icon is clicked.
- Table with delete (trash icon) and edit (pencil icon).
- Validation errors render inline under the offending field — never `alert()`.

### 10.4 Categories & Budgets screens
- Same shape as Transactions: list at the top, form below.
- Categories show a colour swatch.
- Budgets show the month/year selector and the limit; the form prevents creating a duplicate `(category, month, year)` thanks to the DB unique constraint surfacing as a 409.

### 10.5 Frontend auth lifecycle

- On page load, `app.js` calls `GET /api/auth/me`. If it returns 401, the access token attempt fails; `api()` then transparently calls `POST /api/auth/refresh`. If that succeeds, `me` is retried and the dashboard renders. If both fail, the auth screen is shown.
- During session, every `fetch` goes through `api()`, which attaches `Authorization: Bearer <accessToken>` and `credentials: 'include'`. On a 401 response it tries one refresh + one retry. A second 401 → log the user out.
- Logout: `POST /api/auth/logout` → clear the in-memory access token → render the auth screen.

---

## 11. Data Model & Schema (post-auth)

```sql
-- Users
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(72)  NOT NULL,
  display_name  VARCHAR(80),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email_lower ON users (LOWER(email));

-- Refresh tokens (server-side, revocable)
CREATE TABLE refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  revoked_at  TIMESTAMP,
  replaced_by INTEGER REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent  VARCHAR(255),
  ip          VARCHAR(45),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user        ON refresh_tokens (user_id);

-- Categories  (now per-user)
CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7) DEFAULT '#cccccc',
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT categories_user_name_unique UNIQUE (user_id, name)
);
CREATE INDEX idx_categories_user ON categories (user_id);

-- Transactions
CREATE TABLE transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  type        VARCHAR(10) NOT NULL CHECK (type IN ('income','expense')),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_transactions_user      ON transactions (user_id);
CREATE INDEX idx_transactions_user_date ON transactions (user_id, date DESC);

-- Budgets
CREATE TABLE budgets (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INTEGER NOT NULL,
  limit_amount NUMERIC(10,2) NOT NULL CHECK (limit_amount >= 0),
  CONSTRAINT budgets_user_cat_month_year_unique UNIQUE (user_id, category_id, month, year)
);
CREATE INDEX idx_budgets_user ON budgets (user_id);
```

Two derived views are computed on demand (no materialised view needed at this scale):

- **Monthly summary** (`/transactions/summary`) — `SUM(amount) GROUP BY type` for the user, scoped to a month range.
- **Budget status** (`/budgets/status`) — left-join budgets with `SUM(transactions.amount WHERE type='expense' AND date IN <month>)`, returning `limit`, `spent`, `remaining`, `percent`, `over_budget`.

---

## 12. Security Model

A condensed view (full detail in `AUTH_DESIGN.md`):

| Concern | Mitigation |
|---|---|
| Password theft | bcrypt cost 12, never logged, min length 8, max 72. |
| User enumeration | Same 401 message and timing for "no such email" and "wrong password". |
| Token theft via XSS | Access token in memory only; refresh token in `httpOnly` cookie. |
| Refresh token theft | Token hashed at rest; rotated on every refresh; reuse → revoke entire family. |
| Cross-tenant data leak | Every model query scoped by `user_id`; cross-user reads return 404. |
| CSRF | `SameSite=Strict` on the refresh cookie + Bearer header on state-changing requests. |
| Brute force | `express-rate-limit` on `/auth/login` and `/auth/register`. |
| Header sniffing / clickjacking | `helmet()` defaults. |
| Secret leakage | `.env` ignored; missing `JWT_ACCESS_SECRET` makes the server fail-fast at boot. |
| SQL injection | Only parameterized queries; column whitelists for filterable fields. |
| Open CORS in prod | Config-driven origin allow-list (open in dev, locked in prod). |

---

## 13. Quality Attributes (NFRs)

| Attribute | Target | How we'll know |
|---|---|---|
| Correctness | 100% of unit tests green; manual click-through covers every story | `npm test` + scripted demo |
| Performance | p95 endpoint latency < 100 ms locally (Postgres + Node on the same machine) | informal `time curl` after seeding 1k tx |
| Security | OWASP Top 10 spot-checks pass; static review by `security-reviewer` agent | review pass |
| Maintainability | Files < 400 lines, services pure, layering preserved | grep `wc -l` + lint |
| Testability | Services unit-testable with mocked models; coverage ≥ 85% | jest coverage |
| Observability | Every request logs method, path, status, latency, user id (or `-`) | one structured logger middleware |
| Portability | `git clone && npm install && createdb && schema.sql && npm start` works on a fresh machine | tested by re-running setup steps |

---

## 14. Testing Strategy

- **Service units (Jest, mocked models)** — the core. Cover validation rejection, happy path, NotFound, filter whitelist, ownership scoping (post-auth), date edges (Feb 28/29, Apr 30), budget overspend, summary aggregation.
- **Auth integration (supertest)** — register → login → refresh → me → logout → refresh-after-logout returns 401. One file, no DB needed beyond a per-suite test schema or an in-memory mock at the model layer.
- **Frontend** — manual click-through (course allows it). Test plan listed in `STATUS.md` and walked at presentation time.
- **CI** — `npm ci && npm run lint && npm test` on every push to `main`. Green badge in README.

Coverage target after auth ships: **~95 tests / 6 suites / ≥ 85% statements on services**.

---

## 15. Observability & Operations

This is a graded local-demo app, so operations is light by design:

- **Logging:** one minimal middleware that prints `METHOD PATH → STATUS (Δms) user=<id|-> ` to stdout. No log files, no PII beyond user id.
- **Health check:** `GET /health` returns `{status:"ok"}`. Used by humans and any future container probe.
- **Errors:** central error middleware maps typed errors to status codes; uncaught errors log a stack trace and return a generic 500 message (no leak).
- **Migrations:** for now, the canonical schema is `schema.sql`. If the iterations grow, we'll add numbered files (`migrations/0001_init.sql`, `0002_auth.sql`) and a tiny runner — but only when the second migration appears.
- **Backups:** out of scope (no production deploy).

---

## 16. Deployment Model

For the course: the demo is **local**. Backend `npm start` on port 3000, Postgres on 5432, frontend opened from `file://` or a static server. All grading happens on the developer's laptop, screen-shared.

If a future iteration needs a real deploy, the path is:

1. Containerise (Dockerfile for backend, official `postgres:16-alpine` for DB, `docker-compose.yml` to orchestrate).
2. Switch CORS to a config-driven allow-list, set `COOKIE_SECURE=true`.
3. Pick a cheap host (Fly.io / Render / Railway). Static frontend on the same host or any CDN.

The current code is written so this transition is configuration, not surgery.

---

## 17. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Project path contains non-ASCII characters → `jest --runInBand` hangs on macOS | High (blocks tests entirely) | Move repo to an ASCII path (`~/Desktop/walletlog`) before submission; documented in `STATUS.md`. |
| Adding `user_id` to existing rows | Medium | For the course, do a clean DB reset; full backfill plan documented in `AUTH_DESIGN.md` §9. |
| `bcrypt` native build fails on a target machine | Low | Fallback to `bcryptjs` is a one-line dependency swap. |
| CORS is wide-open → won't fly in a real prod | Low for course | Documented in README; production hardening listed in §16. |
| Token in localStorage suggestion creeping in via copy-paste from tutorials | Medium | Single rule in code: access token only ever lives in the IIFE scope. Code review enforces. |
| Time pressure near submission | Medium | Implementation order (§18) keeps the system runnable after every step, so an early stop still ships a working product. |

---

## 18. Implementation Order (no timeline — ordering only)

Each step keeps the app in a runnable state; if we stop at any step, we still have something demo-able.

1. **Schema & utilities** — add `users`, `refresh_tokens`, add `user_id` columns, write `utils/password.js` and `utils/jwt.js`.
2. **User & token models** — `userModel.js`, `refreshTokenModel.js`.
3. **Auth service** — register, login, refresh, logout, me.
4. **Auth middleware** — `requireAuth` + auth-route rate limit + helmet + cookie-parser wired into `index.js`.
5. **Auth routes** — `/api/auth/*`, mounted with rate limiter.
6. **Scope existing modules** — every model query and every service call now takes `userId`; tests updated.
7. **Swagger** — security schemes, `/auth/*` paths, `security: [bearerAuth]` default for protected paths.
8. **Frontend auth screen** — login + register tabs, inline errors.
9. **Frontend `api()` helper** — Bearer header, `credentials: 'include'`, transparent refresh-on-401.
10. **Frontend boot sequence** — `me` on load, gate the dashboard.
11. **Tests** — auth service unit tests, jwt unit tests, supertest auth integration, scoping assertions in existing service tests.
12. **README + .env.example** — register/login flow, "Authorize in Swagger" instructions, every new env var documented.
13. **Lint + CI** — green pipeline.
14. **Manual click-through** — two browser sessions: User A cannot see User B's anything.
15. **ZIP** — exclude `node_modules`.

---

## 19. Definition of Done (project-level)

- `npm test` reports all suites passing (≥ ~95 tests).
- `npm run lint` is clean.
- `npm run dev` boots; `curl /health` returns `{status:"ok"}`.
- A new visitor can register → see an empty dashboard → add a category → log a transaction → set a budget → see the dashboard reflect it, **without ever reloading the page**.
- A second user, registered separately, sees zero data from the first user.
- `/api-docs` lists every endpoint, with the Authorize button working for protected routes.
- README walks a fresh machine from clone to running app, including auth.
- Repo is in Git with meaningful commit history; CI is green on `main`.
- ZIP for submission contains everything except `node_modules/`.

---

## 20. Possible Next Iterations (deliberately out of scope now)

Listed so they exist on paper but aren't promised:

- Recurring transactions (e.g. "rent on the 1st").
- Receipt photo upload (S3 / local FS) and OCR.
- CSV import / export.
- Budget rollover (carry unspent amount to next month).
- Email password-reset flow.
- OAuth (Google) login.
- Mobile companion (React Native or native iOS) using the same API.
- Shared budgets between two users (couples / housemates).
- Public read-only "share my month" link with an expiring token.

These are the gravitational directions the current architecture leaves open — none of them require a rewrite.
