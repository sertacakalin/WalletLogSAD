# WalletLog — Auth Tasarımı

JWT tabanlı kimlik doğrulama, kullanıcı bazlı veri izolasyonu.

## Genel Bakış

İki token:

| Token | Süre | Yeri | İçeriği |
|---|---|---|---|
| **Access token** | 15 dk | Frontend'de memory (JS değişkeni) | JWT — `sub`, `email`, `iss`, `aud` |
| **Refresh token** | 7 gün | `httpOnly` + `SameSite=Strict` cookie | Opaque random — DB'de hash'li |

**Neden ikiye böldük?** Access stateless (DB hit'i yok, hızlı), kısa ömürlü olduğu için iptal şart değil. Refresh DB'de tutulur, anlık iptal edilebilir (logout, ihlal, parola değişimi).

## Akış

```
register/login
  → 201/200 + { user, accessToken }
  → Set-Cookie: refresh_token (httpOnly)

API çağrısı
  → Authorization: Bearer <accessToken>
  → 401 alırsa → POST /api/auth/refresh (cookie ile) → yeni accessToken → tekrar dene

logout
  → POST /api/auth/logout
  → refresh DB'de revoked_at, cookie clear
```

## Şema

```sql
users (id, email UNIQUE, password_hash, display_name, created_at)
refresh_tokens (id, user_id FK, token_hash, expires_at, revoked_at, replaced_by FK)
```

Her veri tablosu (categories, transactions, budgets, wallets, recurring_transactions) `user_id NOT NULL REFERENCES users(id) ON DELETE CASCADE` içerir.

## JWT Detayı

- **Algoritma**: HS256, `JWT_ACCESS_SECRET` (≥ 32 byte random hex)
- **Claims**: `sub` (user id), `email`, `iat`, `exp`, `iss=walletlog`, `aud=walletlog-api`
- **PII yok**: payload sadece id + email. Parola, refresh token vs asla içinde değil.

## Güvenlik Tedbirleri

| Tehdit | Önlem |
|---|---|
| Parola sızıntısı | bcrypt cost 12, min 8 char, harf+rakam zorunlu |
| User enumeration | "Email yok" ve "yanlış şifre" aynı 401 mesajı |
| XSS ile token çalma | Access token sadece memory'de, refresh `httpOnly` cookie |
| Refresh token çalma | DB'de hash, her refresh'te rotate, reuse → tüm aileyi iptal |
| Cross-tenant okuma | Her sorgu `WHERE user_id=$1` |
| CSRF | `SameSite=Strict` cookie + Bearer header |
| Brute force | `/api/auth/*` üzerinde 10 req/dk rate limit |
| Header sniffing | `helmet()` middleware |
| SQL injection | Parametrik sorgular, filtre whitelist |
| Sır git'e düşmesi | `.env` gitignored; boot'ta `JWT_ACCESS_SECRET` yoksa fail-fast |

## Status Code Haritası

| Durum | Kod |
|---|---|
| Başarılı login/refresh/me | 200 |
| Register | 201 |
| Logout | 204 |
| Validation (zayıf parola, bozuk email) | 400 |
| Yanlış kimlik bilgisi / geçersiz token | 401 |
| Başkasının kaydına erişim | 404 (varlığı saklar) |
| Email zaten kayıtlı | 409 |
| Rate limit | 429 |

## Frontend

- **Auth ekranı**: SPA içinde tabbed Login/Register, dashboard'dan ayrı
- **`api()` helper**: Bearer header ekler, `credentials: 'include'`, 401'de bir kere refresh deneyip retry, ikinci 401'de logout
- **Boot**: Sayfa açılınca silent `/api/auth/refresh` denenir — başarılıysa dashboard, değilse login ekranı
- **Logout**: `POST /api/auth/logout` → memory'deki accessToken temizlenir → login ekranı

## Dosya Yapısı

```
backend/
├── middleware/
│   ├── authMiddleware.js    requireAuth (Bearer doğrula, req.user'a ata)
│   └── rateLimit.js          auth route'larında 10/dk limit
├── routes/authRoutes.js      /register, /login, /refresh, /logout, /me
├── services/authService.js   register, login, refresh, logout, me
├── models/
│   ├── userModel.js
│   └── refreshTokenModel.js
└── utils/
    ├── jwt.js                signAccessToken, verifyAccessToken
    ├── password.js           hash, compare (bcrypt)
    └── tokens.js             generateRefreshToken, hashRefreshToken
```
