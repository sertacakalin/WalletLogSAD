# WalletLog — Durum

## Özet

Stack tamamen kuruldu, ders şartlarının hepsi karşılandı. Geriye sadece operatör işi kaldı: ekran görüntüleri ve teslim ZIP'i. Yapılacaklar `NEXT_STEPS.md`'de.

## Kod Durumu

- **Backend** — Layered (`routes → services → models → db`), tipli hata sınıfları, central error middleware, parametrik SQL, asyncHandler her route'ta.
- **Auth** — JWT (HS256) access + rotating refresh, bcrypt parola, rate limit, helmet, fail-fast secret kontrolü. Tüm korumalı endpoint'lerde `requireAuth`.
- **Multi-tenant izolasyon** — Her sorgu `WHERE user_id=$1`. Service katmanında cross-FK ownership kontrolü (kullanıcı başkasının category/wallet'ına referans veremez).
- **DB** — `schema.sql`: 7 tablo (`users`, `refresh_tokens`, `categories`, `wallets`, `transactions`, `budgets`, `recurring_transactions`). Tüm FK'lerde `ON DELETE CASCADE`.
- **Frontend** — SPA, auth-shell + dashboard + 5 CRUD ekranı. Per-field validasyon, inline hata mesajları. Access token sadece memory'de.
- **API docs** — `swagger.yaml` her endpoint için schema + örnek + hata yanıtı. `/api-docs`'ta Bearer Authorize çalışıyor.
- **Tests** — 10 Jest suite, **156 test**, ~0.5sn. Service katmanında %87 statement coverage. Multi-tenant izolasyon testleri var.
- **Lint + CI** — ESLint temiz, GitHub Actions her push'ta `npm ci && npm run lint && npm test`.

## Ders Şartlarına Karşılık

| Kriter | Ağırlık | Durum |
|---|---|---|
| CRUD (3+ entity × 4 fiil) | 25% | ✓ Categories, Transactions, Budgets, Wallets, Recurring — her biri tam CRUD |
| Kod kalitesi / modülerlik | 20% | ✓ Layered, services pure, dosya başına < 250 satır |
| REST tasarımı | 15% | ✓ Doğru fiil + status + JSON |
| Swagger | 10% | ✓ Schema'lar, hatalar, Bearer auth |
| Tests | 15% | ✓ 156 servis testi |
| README | 10% | ✓ Reproducible |
| Git | 5% | ✓ GitHub'da, anlamlı commit'ler |
| Bonus: GitHub Actions | + | ✓ CI yeşil |

## Sağlık Kontrolü

```bash
cd backend
npm install
npm test            # 10 suite, 156 test, hepsi yeşil
npm run lint        # exit 0
npm run dev         # "Server running: http://localhost:3000"
curl http://localhost:3000/health   # {"status":"ok"}
```

Bunlardan biri kırılırsa önce o regresyonu düzelt.

## Bilinmesi Gerekenler

- Server boot'ta `JWT_ACCESS_SECRET` yoksa veya 16 char'dan kısaysa fail eder.
- Postgres **5433** portunda (Homebrew `postgresql@15`, `trust` auth). `.env` zaten doğru.
- Rate limit: `/api/auth/*` üzerinde 10 req/dk/IP.
- CORS local için açık — prod'da daraltılmalı.
