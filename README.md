# WalletLog

Kişisel gelir-gider takip uygulaması. Kullanıcı kayıt olur, işlemlerini cüzdan
ve kategori bazında kaydeder, aylık bütçe koyar, dashboard'dan trendlerini
görür. **System Analysis & Design** dersi (Bahar 2026) projesi.

- 156 unit test (Jest)
- GitHub Actions CI (lint + test)
- Swagger UI ile interaktif API dokümantasyonu
- Her kullanıcı yalnızca kendi verisini görür (per-row `user_id` izolasyonu)

## İçindekiler

- [Tech Stack](#tech-stack)
- [Özellikler](#özellikler)
- [Hızlı Başlangıç](#hızlı-başlangıç)
- [Yapılandırma](#yapılandırma)
- [API](#api)
- [Test ve Lint](#test-ve-lint)
- [Proje Yapısı](#proje-yapısı)

## Tech Stack

| Katman | Seçim |
|--------|-------|
| Frontend | Vanilla JavaScript (SPA) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT (HS256) + rotating refresh token |
| API Docs | Swagger / OpenAPI 3.0 |
| Test | Jest |
| CI | GitHub Actions + ESLint |

## Özellikler

- Kayıt, giriş, çıkış (access token + httpOnly refresh cookie)
- Kategori CRUD
- Cüzdan (wallet) CRUD — gerçek zamanlı bakiye
- Gelir / gider işlemi CRUD — tarih ve kategori filtreleme
- Aylık özet: toplam gelir, gider, fark
- Aylık kategori bütçesi ve aşım uyarısı
- Yinelenen işlemler (haftalık / aylık / yıllık)
- Dashboard: aylık trend grafiği, en çok harcama yapılan kategoriler

## Hızlı Başlangıç

**Gereksinimler:** Node.js 18+, PostgreSQL 14+

```bash
git clone https://github.com/sertacakalin/WalletLogSAD.git walletlog
cd walletlog/backend
npm install
cp .env.example .env
```

`.env` içine 32 byte'lık rastgele JWT secret yaz:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Veritabanını oluştur ve şemayı yükle:

```bash
psql -U postgres -c "CREATE DATABASE walletlog;"
psql -U postgres -d walletlog -f schema.sql
```

Sunucuyu başlat:

```bash
npm run dev      # nodemon, hot reload
# veya
npm start        # düz node
```

| URL | Ne var |
|-----|--------|
| `http://localhost:3000` | Uygulama (login → dashboard) |
| `http://localhost:3000/api-docs` | Swagger UI |
| `http://localhost:3000/health` | Sağlık kontrolü |

## Yapılandırma

`.env` değişkenleri:

| Değişken | Açıklama |
|----------|----------|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL bağlantısı |
| `PORT` | API portu (varsayılan 3000) |
| `CORS_ORIGIN` | Frontend origin allow-list (boş = dev modu, açık) |
| `JWT_ACCESS_SECRET` | **Zorunlu**, ≥ 32 byte hex |
| `ACCESS_TOKEN_TTL` | Access token süresi (varsayılan `15m`) |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token süresi (varsayılan `7`) |
| `BCRYPT_COST` | bcrypt cost (varsayılan `12`) |
| `COOKIE_SECURE` | HTTPS prod'da `true`, localhost'ta `false` |

Sunucu boot'ta `JWT_ACCESS_SECRET` yoksa veya 16 karakterden kısaysa hata
verip kapanır (fail-fast).

## API

Tüm endpoint'ler ve örnekler interaktif olarak: **`/api-docs`**

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/api/auth/register` | Hesap aç (otomatik login) |
| POST | `/api/auth/login` | Giriş |
| POST | `/api/auth/refresh` | Refresh token rotate |
| POST | `/api/auth/logout` | Çıkış (cookie temizle) |
| GET | `/api/auth/me` | Mevcut kullanıcı |
| CRUD | `/api/categories` | Kategoriler |
| CRUD | `/api/wallets` | Cüzdanlar |
| CRUD | `/api/transactions` | İşlemler (filtre: `type`, `category_id`, `wallet_id`, tarih) |
| GET | `/api/transactions/summary` | Aylık özet |
| CRUD | `/api/budgets` | Bütçeler |
| GET | `/api/budgets/status` | Kategori bazında harcanan / kalan / aşım |
| CRUD | `/api/recurring` | Yinelenen işlemler |
| GET | `/api/dashboard` | Dashboard verisi |

Korunan endpoint'ler `Authorization: Bearer <accessToken>` header'ı ister.

### Status kodları

| Kod | Anlam |
|-----|-------|
| 200 / 201 / 204 | Başarılı okuma / oluşturma / silme |
| 400 | Doğrulama hatası |
| 401 | Token yok, geçersiz veya yanlış şifre |
| 404 | Bulunamadı (başka kullanıcıya ait kayıt da 404 döner) |
| 409 | Çakışma (unique constraint vb.) |
| 429 | Rate limit (`/api/auth/*` için 10 req/dk/IP) |
| 500 | Sunucu hatası |

## Test ve Lint

```bash
npm test         # 156 Jest unit test (DB gerektirmez, model katmanı mock'lu)
npm run lint     # ESLint
```

CI her push'ta `lint → test` zincirini koşturur.

## Proje Yapısı

```
walletlog/
├── backend/
│   ├── routes/         HTTP handler — iş mantığı yok
│   ├── services/       iş mantığı + doğrulama (test'li)
│   ├── models/         parametrik SQL
│   ├── middleware/     auth, error handler, rate limit
│   ├── utils/          jwt, password, dates
│   ├── tests/          Jest unit testler
│   ├── errors.js       tipli hata sınıfları
│   ├── index.js        Express app + Swagger mount
│   ├── swagger.yaml    OpenAPI 3.0 spec
│   └── schema.sql      veritabanı şeması
├── frontend/
│   ├── index.html      SPA shell
│   ├── styles.css
│   └── app.js          fetch + auto-refresh + render + validation
└── .github/workflows/  CI: lint + test
```

Katmanlama kuralı: **routes → services → models → db.**
Routes iş mantığı içermez, services doğrudan SQL yazmaz. Her korunan sorgu
`user_id` ile filtrelenir.

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| `FATAL: JWT_ACCESS_SECRET must be set` | `.env`'ye 32 byte hex değer ekle |
| `ECONNREFUSED ::1:5432` | PostgreSQL çalışmıyor (`brew services start postgresql@15`) veya port farklı |
| `password authentication failed` | `.env`'deki `DB_USER` / `DB_PASSWORD` yanlış |
| Login çalışıyor ama sayfa yenilenince tekrar login | Cookie blocked — frontend ve API aynı origin'de olmalı |
| `npm run dev` çıktısız donar | Proje iCloud-senkronlu klasörde (`~/Desktop`, `~/Documents`) — `~/walletlog` gibi senkron dışı bir yere taşı, `rm -rf node_modules && npm ci` |
| `429 Too many requests` | `/api/auth/*` rate limit (10 req/dk/IP) — 1 dakika bekle |

## License

ISC.
