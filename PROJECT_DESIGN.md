# WalletLog — Proje Tasarımı

**Ders:** System Analysis & Design, Bahar 2026
**Yan dokümanlar:** `README.md` (kurulum) · `AUTH_DESIGN.md` (auth detayı)

## Tek Cümle

Kullanıcı kayıt olur, gelir/gider işlemlerini kategorilere ayırır, cüzdan bazında bakiyesini tutar, aylık bütçe sınırı koyar ve dashboard üzerinden ay sonunda nerede olduğunu görür.

## Hedef Kullanıcı

22 yaşında bir üniversite öğrencisi. Part-time iş ve aileden gelen küçük bir transferden geçiniyor. Yemek/ulaşım/eğlence kalemlerinde aşıp aşmadığını bilmek istiyor.

## Kapsam

**Var:**
- Kayıt, giriş, çıkış (JWT — herkes sadece kendi verisini görür)
- Kategori CRUD
- Cüzdan CRUD + bakiye hesabı
- Gelir/gider CRUD, filtreleme (tip / kategori / tarih)
- Aylık özet (income / expense / balance)
- Aylık kategori bütçesi + aşım uyarısı
- Yinelenen işlemler (haftalık / aylık / yıllık)
- Dashboard (aylık trend, en çok harcanan kategoriler, yaklaşan ödemeler, içgörüler)
- Swagger UI
- Frontend + backend validasyon
- Service katmanı üzerinde unit testler

**Yok (kapsam dışı, bilinçli):**
- Çoklu döviz
- Fiş foto / OCR
- Bank entegrasyonu, mobil uygulama, push notification
- OAuth / email doğrulama / şifre sıfırlama maili
- Rol / paylaşım / grup bütçesi

## Domain Model

```
users 1───N transactions    N───1 categories
  │                                    │
  │ 1                                  │ 1
  │ N                                  │ N
refresh_tokens                       budgets
                                       │
users 1───N wallets    N───1 transactions
users 1───N recurring_transactions
```

- `users.email` global UNIQUE
- `categories.name` kullanıcı başına UNIQUE
- `budgets`: `(user_id, category_id, month, year)` UNIQUE — bir ay-kategori için tek bütçe
- `wallets.name` kullanıcı başına UNIQUE
- Kullanıcı silinince her şey cascade siler

## Mimari

```
Frontend (Vanilla JS SPA)
   │   HTTP · Bearer JWT · refresh cookie
   ▼
Backend (Express)
   routes  →  services  →  models  →  PostgreSQL
   (HTTP)     (logic)      (SQL)

middleware: helmet · cookie-parser · cors · authMiddleware · rate-limit · errorHandler
```

**Katman kuralları:**
- **Routes** — HTTP parse'lar, bir service fonksiyonu çağırır, JSON + status döner. Business logic yok.
- **Services** — Validation + iş kuralları + tipli hatalar (`ValidationError`, `NotFoundError`, `ConflictError`). Test edilen katman.
- **Models** — Sadece parametrik SQL. Karar vermez.
- **Middleware** — Cross-cutting: auth, JSON parse, cookie, header güvenliği, rate limit, hata → HTTP eşlemesi.

## Tech Stack

| Katman | Seçim | Neden |
|---|---|---|
| Frontend | Vanilla JS | Ders kuralı; framework yok |
| Backend | Node.js + Express 4 | Ders kuralı |
| DB | PostgreSQL 14+ | Transactional, CHECK + UNIQUE composite constraint'ler |
| Auth | JWT (HS256) + opaque refresh | Stateless verify + revoke edilebilir refresh |
| Şifreleme | bcrypt cost 12 | Endüstri standardı, otomatik salt |
| API docs | swagger-ui-express + YAML | Ders zorunluluğu, interaktif test |
| Tests | Jest (model mocked) | Servis katmanı için yeterli |
| Lint | ESLint (`eslint:recommended`) | Bonus puan, CI'da otomatik |
| CI | GitHub Actions | install → lint → test |

## API

Detay için `http://localhost:3000/api-docs`.

**Public:** `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`

**Bearer ile korumalı:** `/api/auth/me`, `/api/categories`, `/api/transactions` (+ `/summary`), `/api/budgets` (+ `/status`), `/api/wallets`, `/api/recurring`, `/api/dashboard`

Her korumalı sorgu `req.user.id` ile filtrelenir. Başkasının kaydını sormak **404** döndürür — 403 değil (varlığı saklamak için).

## Status Code Haritası

| Kod | Anlam |
|---|---|
| 200 | OK / GET / PUT |
| 201 | POST oluşturuldu |
| 204 | DELETE / logout |
| 400 | Validation hatası |
| 401 | Token yok / geçersiz / yanlış kimlik |
| 404 | Yok (veya başka kullanıcıya ait) |
| 409 | Conflict (duplicate name/email) |
| 429 | Rate limit |
| 500 | Beklenmeyen hata |

## Güvenlik Modeli

Detay için `AUTH_DESIGN.md`. Özet:

- bcrypt parola (cost 12), parola loglara düşmez
- JWT 15 dk, refresh 7 gün rotate, reuse'da aile iptal
- Refresh `httpOnly` + `SameSite=Strict` cookie
- Her sorgu `user_id` filtreli — cross-tenant okuma 404 döner
- Service katmanında ownership kontrolü: bir kullanıcı başkasının `category_id`/`wallet_id`'sine FK veremez (400 döner)
- `helmet()`, parametrik SQL, rate limit, fail-fast JWT secret kontrolü

## Test Stratejisi

- **Service unit (Jest)** — validation reddi, happy path, NotFound, filtre whitelist, ownership, tarih kenarları (Şubat 28/29), aşım, özet toplama
- **Auth unit** — register / login / refresh rotate / reuse detection / logout idempotent
- **Frontend** — manuel tıklama turu (ders izin veriyor)
- **CI** — her push'ta `npm ci && npm run lint && npm test`

Şu an: **10 suite, 156 test, %87 statement coverage.**

## Dosya Yapısı

```
walletlog/
├── backend/
│   ├── routes/       HTTP handler (logic yok)
│   ├── services/     business logic + validation (test'li)
│   ├── models/       parametrik SQL
│   ├── middleware/   auth, errorHandler, rate-limit
│   ├── utils/        dates, jwt, password, tokens
│   ├── tests/        Jest unit testler
│   ├── errors.js     tipli hata sınıfları
│   ├── index.js      Express app
│   ├── swagger.yaml  OpenAPI 3.0
│   └── schema.sql    DB şeması
├── frontend/
│   ├── index.html    SPA shell (auth + dashboard + CRUD)
│   ├── styles.css
│   └── app.js        fetch + auto-refresh + render
└── .github/workflows/ci.yml
```

## Sonraki İterasyonlar (planlanmadı, mimari yolu kapamıyor)

- CSV import / export
- Receipt foto yükleme + OCR
- Bütçe rollover (kalan limiti bir sonraki aya devret)
- OAuth (Google) login
- Çiftler için paylaşımlı bütçe
- "Ayımı paylaş" expirable read-only link
