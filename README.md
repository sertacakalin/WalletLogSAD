# WalletLog

Kişisel gelir-gider takip uygulaması. Kullanıcı kayıt olur, gelir/gider
işlemlerini kategorilere göre kaydeder, cüzdan bazında bakiyesini görür ve
aylık kategori bazlı bütçe belirler. **System Analysis & Design** dersi
(Bahar 2026) için.

## Tech Stack

- **Frontend** — Vanilla JavaScript SPA
- **Backend** — Node.js + Express
- **Database** — PostgreSQL
- **Auth** — JWT + refresh token
- **API Docs** — Swagger UI
- **Tests** — Jest

## Özellikler

- Kayıt / giriş (JWT, her kullanıcı sadece kendi verisini görür)
- Kategori CRUD
- Cüzdan (wallet) CRUD ve bakiye hesabı
- Gelir/gider işlemi CRUD, tarih ve kategori filtreleme
- Aylık özet (gelir / gider / fark)
- Aylık kategori bütçesi ve aşım uyarısı
- Yinelenen işlemler (haftalık / aylık / yıllık)
- Dashboard: aylık trend, en çok harcanan kategoriler, yaklaşan ödemeler

## Kurulum

Node.js 18+ ve PostgreSQL 14+ gerekli.

```bash
git clone https://github.com/sertacakalin/WalletLogSAD.git walletlog
cd walletlog/backend
npm install
cp .env.example .env
```

`.env` içine bir JWT secret yaz:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Veritabanını oluştur:

```bash
psql -U postgres -c "CREATE DATABASE walletlog;"
psql -U postgres -d walletlog -f schema.sql
```

Çalıştır:

```bash
npm run dev
```

`http://localhost:3000` — login ekranı, sonra dashboard.

## API

İnteraktif dokümantasyon: **`http://localhost:3000/api-docs`**

| Method | Path | Açıklama |
|---|---|---|
| POST | `/api/auth/register` | Hesap aç |
| POST | `/api/auth/login` | Giriş yap |
| POST | `/api/auth/logout` | Çıkış yap |
| CRUD | `/api/categories` | Kategoriler |
| CRUD | `/api/transactions` | İşlemler |
| CRUD | `/api/budgets` | Bütçeler |
| CRUD | `/api/wallets` | Cüzdanlar |
| CRUD | `/api/recurring` | Yinelenen işlemler |
| GET | `/api/dashboard` | Aylık özet ekranı |

Korunan endpoint'ler `Authorization: Bearer <accessToken>` ister.

## Testler

```bash
npm test
```

156 Jest unit testi (service katmanı).

## Lint

```bash
npm run lint
```

ESLint her push'ta GitHub Actions üzerinden çalışır.

## Yapı

```
walletlog/
├── backend/
│   ├── routes/       HTTP handler (business logic yok)
│   ├── services/     business logic + validation (test'li)
│   ├── models/       parametrik SQL
│   ├── middleware/   auth, error handler, rate limit
│   ├── tests/        Jest unit testler
│   ├── index.js      Express app
│   ├── swagger.yaml  OpenAPI 3.0
│   └── schema.sql    veritabanı şeması
└── frontend/         index.html + styles.css + app.js
```

Katmanlama: routes → services → models → db. Her sorgu `user_id` ile
filtrelenir, kullanıcılar birbirinin verisini göremez.

## License

ISC.
