# WalletLog — Project Context (CLAUDE.md)

## Course
**System Analysis and Design — Spring 2026 (Istanbul Arel Uni)**
Owner: Sertac Akalin · Email: sertacakalin0@gmail.com
Submission ZIP: **2026-05-21** · Presentations: **2026-05-22** & **2026-06-05**

## What This Project Is
A full-stack personal expense tracker. Users record income/expense transactions, group them by category, and set monthly budget caps. Domain is data-centric, daily-life relevant — fits the requirement spec.

## Hard Rules (from course PDF)
- Frontend: **Vanilla JS only** — no React/Vue/Angular. Must be SPA, fetch-based, no full reloads.
- Backend: **Node.js + Express**.
- Database: free choice → **PostgreSQL**.
- Business logic **MUST live in services**, NOT in routes (so it's unit-testable).
- Unit tests are required for **business logic** (services). Routes don't need to be tested.
- Validation on **both** frontend and backend.
- REST: standard HTTP verbs, proper status codes, JSON in/out.
- Swagger UI must be interactive at `/api-docs`.
- Git + GitHub mandatory. Push regularly. Bonus: GitHub Actions linter.
- README.md must be reproducible (setup + run + API).

## Tech Stack (locked)
| Layer | Choice |
|---|---|
| Frontend | Vanilla JS, single `index.html` SPA |
| Backend | Node.js, Express 4 |
| DB | PostgreSQL 14+ |
| API docs | Swagger UI (`swagger-ui-express` + YAML) |
| Tests | Jest |
| Linter (bonus) | ESLint + GitHub Actions |

## Domain Model
Three entities, all CRUD-capable:

```
categories (id, name UNIQUE, color, created_at)
   └── transactions (id, title, amount, type∈{income,expense}, category_id FK, date, note)
   └── budgets      (id, category_id FK, month 1-12, year, limit_amount, UNIQUE(cat,month,year))
```

**Extra features** (beyond plain CRUD, satisfying spec's "additional feature"):
- Filtering on transactions (type, category_id, date range)
- Monthly summary endpoint (`GET /api/transactions/summary?month=&year=`)
- Budget status / overspend detection (`GET /api/budgets/status?month=&year=`)
- Relationships: transaction→category, budget→category

## Folder Layout
```
walletlog/
├── backend/
│   ├── routes/        thin HTTP handlers (NO business logic)
│   ├── services/      business logic + validation (UNIT-TESTED)
│   ├── models/        DB queries only (parameterized, no logic)
│   ├── tests/         Jest unit tests for services
│   ├── index.js       Express app + Swagger mount
│   ├── swagger.yaml   OpenAPI 3.0 spec
│   └── schema.sql     DB schema
├── frontend/
│   └── index.html     SPA (HTML + CSS + JS in one file is OK for scope)
├── README.md
└── CLAUDE.md          ← this file
```

## Architectural Conventions
- **Layered**: routes → services → models → db. Never skip layers.
- Routes are dumb: parse req → call service → return JSON + status code.
- Services own validation, business rules, error throwing.
- Models do raw SQL via parameterized queries. No business decisions.
- Errors thrown in services bubble up; routes map them to HTTP codes.
- Async/await everywhere. No callback hell.

## HTTP Status Code Map
| Action | Success | Failure |
|---|---|---|
| GET list | 200 | 500 |
| GET one | 200 | 404 / 500 |
| POST | 201 | 400 (validation) / 500 |
| PUT | 200 | 400 / 404 / 500 |
| DELETE | 204 | 404 / 500 |

## Definition of Done (per task)
- [ ] Code compiles, server boots cleanly
- [ ] Endpoint works in Swagger UI
- [ ] Frontend exercises endpoint without page reload
- [ ] Validation rejects bad input on **both** sides
- [ ] At least one Jest test for any new service function
- [ ] Committed with meaningful message and pushed

## Working Style with Sertac
- **No timelines, no calendar plans.** Just tell what will be done + result.
- English in deliverables (course req); Turkish for casual chat.
- Short, direct, proactive. Spot the issue, propose the fix.
- After every code change, run reviewer/verifier flow.
- Each Thursday: progress report + thesis-style summary in English.

## Commands Cheat Sheet
```bash
# install
cd backend && npm install
# run dev
npm run dev          # nodemon on :3000
# tests
npm test
# DB bootstrap
psql -U postgres -c "CREATE DATABASE walletlog;"
psql -U postgres -d walletlog -f backend/schema.sql
# swagger
open http://localhost:3000/api-docs
# frontend
open frontend/index.html   # or serve via Live Server
```

## Evaluation Weighting (don't lose points here)
- 25% CRUD completeness — all three entities, all four verbs
- 20% Code quality / modularity — keep services lean, no logic in routes
- 15% REST design — verbs + status codes + JSON
- 10% Swagger — keep it in sync with real endpoints
- 15% Tests — service-level, cover validation + happy path + edge
- 10% README — reproducible from zero
- 5% Git — frequent, meaningful commits

## Known Risks / Things to Watch
- ⚠️ **Path contains Turkish chars** (`adsız klasör`). On macOS, `jest --runInBand` hangs indefinitely on this path because jest-haste-map deadlocks during fs.stat traversal. Tests pass cleanly when the project lives at an ASCII path. **Recommended action: move the project to `~/Desktop/walletlog` or `~/projects/walletlog`** before final submission. Until then, run tests inside `/tmp/wl-mini` (mirrored copy) — see `npm test` script note in README.
- CORS is wide open (`cors()`) — fine for local, document it.
- `.env` is in `.gitignore` ✅ — never commit secrets.
- Walletlog is currently inside a parent git repo (Desktop). Needs its own `git init` before pushing to GitHub.
