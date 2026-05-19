# Sıradaki Adımlar

Kod tarafı bitti — testler geçiyor, lint temiz, server boot ediyor. Geriye sadece operatör işi kaldı.

## Bağlam

- **Repo:** https://github.com/sertacakalin/WalletLogSAD
- **Yerel klasör:** `~/walletlog`
- **DB:** `walletlog`, Postgres port 5433, şema reset edildi
- **Teslim:** ZIP 2026-05-21, sunum 2026-05-22 ve 2026-06-05

## 1. Manuel UI tıklama turu

```bash
cd ~/walletlog/backend
npm run dev
```

`http://localhost:3000` aç.

Sırasıyla:

- [ ] **Kayıt ol:** `deniz@example.com` / `Sup3rSecret` / display `Deniz` → dashboard açılmalı
- [ ] Categories → `Food` (kırmızı) + `Transport` (yeşil) ekle
- [ ] Categories → `Transport`'u `Bus & Metro` olarak düzenle
- [ ] Wallets → `Cash` ve `Bank` ekle, farklı initial balance'lar ver
- [ ] Transactions → 3 expense + 1 income ekle (en az biri 200+, bütçeyi aşmak için)
- [ ] Transactions → tip/kategori/tarih filtresi dene → Clear çalışmalı
- [ ] Transactions → düzenle, sil
- [ ] Budgets → `Food, May 2026, 100` ekle (aşılmış olacak) + bir aşılmamış bütçe
- [ ] Recurring → bir yinelenen ödeme ekle (`Rent, monthly, 5000`)
- [ ] Dashboard → Mayıs 2026 seç → toplamlar uyumlu, bir bütçe EXCEEDED, yaklaşan ödeme listede
- [ ] **Logout** → auth ekranı
- [ ] **İkinci kullanıcı** `ali@example.com` ile kayıt ol → her şey boş olmalı (izolasyon ispatı)
- [ ] Tekrar `deniz@example.com` ile giriş → verisi yerinde

## 2. Ekran görüntüleri

`docs/screenshots/` klasörünü oluştur, 4 PNG koy:

| Dosya | Yakalanacak |
|---|---|
| `01-login.png` | Auth ekranı, Login sekmesi |
| `02-dashboard.png` | Dashboard, EXCEEDED + OK bütçeyle |
| `03-transactions.png` | Transactions, filtre uygulanmış |
| `04-swagger.png` | Swagger UI, Authorize butonu görünür |

README'ye bağla:

```markdown
## Ekran Görüntüleri

| Login | Dashboard |
|-------|-----------|
| ![Login](docs/screenshots/01-login.png) | ![Dashboard](docs/screenshots/02-dashboard.png) |

| Transactions | Swagger UI |
|--------------|------------|
| ![Transactions](docs/screenshots/03-transactions.png) | ![Swagger](docs/screenshots/04-swagger.png) |
```

## 3. Son test + lint + commit

```bash
cd backend
npm test            # 10 suite, 156 test
npm run lint        # exit 0

cd ~/walletlog
git add docs/ README.md
git commit -m "docs: add screenshots"
git push
```

İstersen teslim noktasını tag'le:

```bash
git tag -a v1.0.0 -m "Submission build"
git push --tags
```

## 4. Teslim ZIP'i

```bash
cd ~
zip -r WalletLogSAD-Sertac.zip walletlog \
  -x "walletlog/backend/node_modules/*" \
  -x "walletlog/backend/.env" \
  -x "walletlog/.git/*" \
  -x "walletlog/**/.DS_Store"
```

Doğrula:

```bash
unzip -l WalletLogSAD-Sertac.zip | grep -E "node_modules|\.env$"
# Beklenen: çıktı yok
```

## 5. Sunum hazırlığı

- Sunumdan önce Postgres ve `npm run dev` çoktan ayakta olsun.
- İki tarayıcı sekmesi: biri Deniz, biri Ali — izolasyonu canlı göster.
- Üçüncü sekmede Swagger — login → Authorize → her endpoint'i tek tıkla.
- Layered yapıyı göstermeye hazır ol: `routes/transactionRoutes.js` → `services/transactionService.js` → `models/transactionModel.js`.
- `npm test` canlı koş: 10 suite, 156 passing.

## Teslim Edildi Tanımı

- [ ] GitHub'da repo güncel, CI yeşil
- [ ] Temiz clone'da `npm install` + DB reset + `npm run dev` çalışıyor
- [ ] Swagger Authorize her korumalı endpoint'te işliyor
- [ ] İki tarayıcı oturumu izolasyonu kanıtlıyor
- [ ] Ekran görüntüleri commit'li ve README'de görünüyor
- [ ] ZIP Uzem'e yüklendi, `node_modules` ve `.env` yok
