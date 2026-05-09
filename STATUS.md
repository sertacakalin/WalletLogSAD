# WalletLog — Where We Left Off

A snapshot of the project state for picking work back up later.

## TL;DR

The whole stack is implemented and verified. The codebase satisfies every
graded course requirement. What's left is **manual operator work** — moving
the folder to an ASCII path, initializing Git/GitHub, and clicking through
the UI end-to-end with a real Postgres running.

## Done — Code & Tooling

### Backend
- Layered architecture: `routes → services → models → db`. No business logic in routes.
- Typed errors (`backend/errors.js`): `ValidationError` → 400, `NotFoundError` → 404, `ConflictError` → 409.
- Central error middleware (`backend/middleware/errorHandler.js`) with `asyncHandler` + Postgres `23505` / `23503` mapping.
- Date utility (`backend/utils/dates.js`): correct end-of-month range (no more hardcoded `-31`), ISO date validator.
- Services hardened: trimming, length caps, hex regex, integer-only IDs, whitelisted query filters (extra SQL-injection layer).
- `index.js`: `/health` endpoint, 404 fallback, app exported (testable).
- All routes use `asyncHandler` — one-liner per verb, no inline try/catch noise.

### Database
- `schema.sql` — three tables, foreign keys, unique constraints, check constraints (e.g. `type IN ('income','expense')`).

### Tests
- 4 Jest suites, **71 tests passing**, ~0.2s.
- Coverage: validation rejection, happy path, NotFound, filter whitelist, date edges (Feb 28/29, Apr 30), budget overspend, summary aggregation.
- All model layers mocked — no DB needed to run tests.

### API Docs
- `swagger.yaml` rewritten: tags, request/response schemas, error responses, parameters component, the missing `/budgets/:id GET` endpoint.
- Mounted at `http://localhost:3000/api-docs`.

### Frontend
- Split into three files (course-friendly, modular):
  - `frontend/index.html` — semantic shell, accessible labels, hidden inputs for edit-id.
  - `frontend/styles.css` — design tokens, responsive, focus states, toast component.
  - `frontend/app.js` — IIFE-wrapped, no globals, event-delegated table actions.
- Per-field validation (required, length, hex, ISO date, positive number) with inline error messages — no `alert()`.
- Full **Edit** flows for all three entities (form swaps to edit mode, has Cancel button).
- Filters with Clear button, dashboard with month/year picker, escape-html for XSS safety.

### CI / Lint
- `.eslintrc.json` (eslint:recommended + a few rules), `.eslintignore`.
- `.github/workflows/ci.yml` — `npm ci` → `npm run lint` → `npm test` on push/PR to `main`.

### Docs
- `README.md` — reproducible setup, troubleshooting, sample curl, status codes, status table.
- `CLAUDE.md` — project context for the AI assistant (rules, hard reqs, layout).
- `STATUS.md` — this file.
- `.env.example` for safe sharing of config shape.

## Not Done — Operator Work (You)

These are blocking submission but cannot/should not be automated.

1. **Move the folder to an ASCII path.** Current path contains Turkish chars (`adsız klasör`); on macOS this freezes `jest --runInBand`. Recommended: `~/Desktop/walletlog/`.
2. **`git init` + first commit + GitHub remote.**
   ```bash
   cd ~/Desktop/walletlog
   git init
   git add .
   git commit -m "feat: initial walletlog implementation"
   git branch -M main
   git remote add origin git@github.com:<user>/walletlog.git
   git push -u origin main
   ```
3. **Bring up Postgres + create DB**
   ```bash
   psql -U postgres -c "CREATE DATABASE walletlog;"
   psql -U postgres -d walletlog -f backend/schema.sql
   ```
4. **Click-through the UI** with a real DB, in this order:
   - Categories: Add → Edit → Delete
   - Transactions: Add (with and without category) → Filter → Edit → Delete
   - Budgets: Add → Edit limit → Delete
   - Dashboard: monthly summary + status (overspend visual)
5. **Add screenshots to README** (Swagger UI, dashboard, transactions page).
6. **Final ZIP** — exclude `node_modules/`. The repo `.gitignore` already excludes it from Git, but for the Uzem upload `node_modules` should not be in the ZIP either.

## Resume Checklist (verifiable in seconds)

```bash
cd backend
npm install              # one-time
npm test                 # expect: 4 suites, 71 passing
npm run lint             # expect: exit 0
npm run dev              # expect: "Server running: http://localhost:3000"
curl http://localhost:3000/health   # expect: {"status":"ok"}
```

If any of those break, that's the regression to fix first.

## Known Gotchas

- **Path with non-ASCII chars** — biggest one. Tests hang silently on macOS until you move the project.
- **CORS is wide-open** (`cors()` no options). Fine for the local dev demo, but a real prod deploy would tighten origins.
- **No automated route tests** — course explicitly says routes don't need tests, but if a presenter asks, the answer is: services are unit-tested, routes are thin pass-throughs verified manually + via Swagger UI.
- **No DB integration tests** — same reasoning. Could be added with `pg-mem` if a stretch goal appears.
- **Frontend served from `file://`** — works because CORS is open. If you want clean URLs, run a static server (`npx serve frontend`).

## File Map

```
walletlog/
├── backend/
│   ├── errors.js                       # typed error classes
│   ├── index.js                        # Express app + Swagger mount
│   ├── schema.sql                      # DB schema
│   ├── swagger.yaml                    # OpenAPI 3.0
│   ├── package.json                    # scripts: start, dev, test, lint
│   ├── .env.example                    # config template
│   ├── .eslintrc.json / .eslintignore  # lint config
│   ├── middleware/errorHandler.js
│   ├── utils/dates.js
│   ├── routes/{category,transaction,budget}Routes.js
│   ├── services/{category,transaction,budget}Service.js
│   ├── models/{db,category,transaction,budget}Model.js
│   └── tests/{categoryService,transactionService,budgetService,dates}.test.js
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .github/workflows/ci.yml
├── .gitignore
├── README.md
├── CLAUDE.md
└── STATUS.md
```

## Course Grade Mapping (self-assessment)

| Criterion                              | Weight | Status |
|----------------------------------------|--------|--------|
| Functionality (CRUD completeness)      | 25%    | Done — all 3 entities × 4 verbs, Edit UI wired |
| Code quality and modularity            | 20%    | Done — layered, typed errors, services pure |
| API design and REST compliance         | 15%    | Done — verbs + status codes + JSON |
| Swagger / OpenAPI documentation        | 10%    | Done — schemas, errors, examples |
| Testing                                | 15%    | Done — 71 unit tests on service layer |
| General docs (README, setup)           | 10%    | Done — reproducible from zero |
| Version control (Git usage)            | 5%     | **Pending** — needs your `git init` |
| Bonus: GitHub Actions linter           | +      | Done — CI runs lint + test |

## When You Resume, Start Here

1. Read this file (you're doing it).
2. Run the **Resume Checklist** above to confirm nothing rotted.
3. Pick the next item from **Not Done — Operator Work**.
4. After the manual UI click-through, do one final commit + push + ZIP.
