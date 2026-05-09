# Sıradaki Adımlar — Operatör Kontrol Listesi

Kod tarafı bitti. Testler geçiyor, lint temiz, server boot ediyor, auth bağlı.
Geriye **operatör işi** kaldı: git init, GitHub'a ilk push, veritabanı resetlemesi,
manuel UI denemesi, ekran görüntüleri ve teslim için ZIP.

Adımları sırayla uygula. Her bloktaki komutlar kopyala-yapıştır ile direkt çalışır.

---

## 0. Hızlı bağlam

- **GitHub repo:** `WalletLogSAD` (zaten hesabında oluşturdun)
- **Yerel klasör:** `/Users/sertacakalin/Desktop/Projects/WalletLog/walletlog`
- **Teslim takvimi:** ZIP — 2026-05-21 · sunumlar 2026-05-22 ve 2026-06-05

---

## 1. `walletlog/` klasörünü kendi Git deposu yap

> Şu an `walletlog/` üst bir Git deposunun **içinde** (ev klasörün ya da
> Desktop). GitHub'a sadece bu projeyi push edebilmek için kendi `.git`'i olmalı.

```bash
cd /Users/sertacakalin/Desktop/Projects/WalletLog/walletlog
git init
git branch -M main
```

### Commit'ten önce sağlık kontrolü

```bash
git status --short
```

Sadece `walletlog/` içindeki dosyaları görmelisin: `backend/`, `frontend/`,
`.md` dosyaları, `.gitignore`, `.github/`. Klasörün dışından bir şey
görüyorsan dur ve haber ver.

Sırların yanlışlıkla commit'e karışmadığından emin ol:

```bash
grep -n "JWT_ACCESS_SECRET" .gitignore                # **/.env satırını bulmalı
git check-ignore -v backend/.env                      # eşleşen kuralı yazmalı
```

Eğer `git check-ignore` `backend/.env` için bir şey yazmazsa **dur** —
commit'ten önce `.gitignore`'u düzelt, yoksa gerçek secret GitHub'a düşer.

---

## 2. İlk commit

```bash
git add .
git commit -m "feat: walletlog with JWT auth, multi-tenant CRUD, Swagger and tests"
```

Commit "boş çalışma alanı" diye şikayet ederse önce `git status` çalıştırıp
gerçekten dosya stage edildi mi kontrol et.

---

## 3. GitHub remote'unu bağla ve push et

`<USER>` kısmına GitHub kullanıcı adını koy (lokal git config'in
`sertacakalin22@istanbularel.edu.tr`, ama GitHub kullanıcı adın farklı
olabilir — boş `WalletLogSAD` reposunun URL'sinden bak).

### SSH (önerilen, parola sormaz)
```bash
git remote add origin git@github.com:<USER>/WalletLogSAD.git
git push -u origin main
```

### HTTPS (yedek)
```bash
git remote add origin https://github.com/<USER>/WalletLogSAD.git
git push -u origin main
```

Kontrol:
```bash
git remote -v          # origin → WalletLogSAD görünmeli, hem fetch hem push
```

Push şu hatayı verirse: *"remote contains work that you do not have locally"* —
demek ki GitHub repo açılırken README ile oluşmuş. Lokalde rebase et:
```bash
git pull --rebase origin main
git push -u origin main
```

---

## 4. Veritabanını yeni şema ile resetle

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS walletlog;"
psql -U postgres -c "CREATE DATABASE walletlog;"
psql -U postgres -d walletlog -f /Users/sertacakalin/Desktop/Projects/WalletLog/walletlog/backend/schema.sql
```

Tabloların oluştuğunu doğrula:
```bash
psql -U postgres -d walletlog -c "\dt"
```
Beklenen çıktı: `users`, `refresh_tokens`, `categories`, `transactions`, `budgets`.

`psql` her seferinde parola soruyorsa `~/.pgpass` oluştur:
```
localhost:5432:walletlog:postgres:postgres
```
(Dosya izni mutlaka `chmod 600 ~/.pgpass` olmalı.)

---

## 5. API'yi başlat + Swagger'ı aç

```bash
cd /Users/sertacakalin/Desktop/Projects/WalletLog/walletlog/backend
npm run dev
```

Beklenen ilk satır:
```
Server running: http://localhost:3000
```

Başka bir terminalde smoke test:
```bash
curl -s http://localhost:3000/health
# {"status":"ok"}

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/categories
# 401
```

Swagger:
```
http://localhost:3000/api-docs
```

---

## 6. Manuel UI tıklama turu (15 dakika — bu aslında sunum provası)

Tarayıcıda `frontend/index.html`'i aç. Eğer cookie `file://`'da takılırsa
bir static server kullan:

```bash
cd /Users/sertacakalin/Desktop/Projects/WalletLog/walletlog
npx serve frontend -p 5173
# tarayıcıda http://localhost:5173
```

(Bu yolu seçersen `backend/.env` içine
`CORS_ORIGIN=http://localhost:5173` ekle ve `npm run dev`'i yeniden başlat.)

### Akış (her adımı yap, kutuları işaretle)

- [ ] **Kayıt ol:** `deniz@example.com` / `Sup3rSecret` / display name `Deniz`
       → dashboard açılmalı, üst barda email görünmeli
- [ ] Categories sekmesi → `Food` (kırmızı) ve `Transport` (yeşil) ekle
- [ ] Categories sekmesi → `Transport`'u düzenle → adını `Bus & Metro` yap → kaydet
- [ ] Transactions sekmesi → 3 farklı tarih ve kategori ile expense ekle
       (en az biri 200+ olsun ki sonradan overspend tetiklensin)
- [ ] Transactions sekmesi → 1 income ekle (`Part-time pay`, mesela 4000)
- [ ] Transactions sekmesi → filtreyi kullan (önce type=expense, sonra category,
       sonra tarih aralığı) → liste daralmalı → **Clear** filtreyi sıfırlamalı
- [ ] Transactions sekmesi → bir transaction'ı düzenle → kaydet
- [ ] Transactions sekmesi → bir transaction'ı sil
- [ ] Budgets sekmesi → `Food, May 2026, 100` ekle (bu **aşılmış** durumda olacak)
- [ ] Budgets sekmesi → bir tane daha bütçe ekle, limiti aşmasın
- [ ] Budgets sekmesi → aşılmış olanın limitini 1000'e güncelle → kaydet
- [ ] Dashboard sekmesi → Mayıs 2026 seç → `Show`
       → Income / Expense / Balance girdiğin verilerle uyumlu olmalı
       → Budget Status iki bütçeni göstermeli, biri `BUDGET EXCEEDED` etiketli olmalı
- [ ] **Logout** → auth ekranı geri gelir
- [ ] **İkinci kullanıcı kaydet** `ali@example.com` / `Sup3rSecret`
       → kategoriler, transaction'lar, bütçeler hepsi **boş** olmalı
       → multi-tenant izolasyonu ispatlandı
- [ ] Logout → tekrar `deniz@example.com` ile giriş → eski verisi yerinde olmalı

Bir adım takılırsa toast'taki hata mesajını ve tarayıcı DevTools network
sekmesindeki status code'u bana yapıştır — debug için yeterli.

---

## 7. Ekran görüntüleri al (course bonus, README bekliyor)

`walletlog/docs/screenshots/` klasörünü oluşturup içine 4 PNG koy.

| Dosya                   | Yakalanacak ekran |
|-------------------------|--------------------|
| `01-login.png`          | Auth ekranı, Login sekmesi açıkken |
| `02-dashboard.png`      | Dashboard, biri OVER biri OK olan iki bütçe ile |
| `03-transactions.png`   | Transactions listesi, filtre uygulanmış halde |
| `04-swagger.png`        | Swagger UI, **Authorize** butonu görünür |

Sonra `README.md`'ye (`## Authentication` bloğunun altına) bu bölümü ekle.
İstersen ben bağlarım, ya da şunu yapıştır:

```markdown
## Ekran Görüntüleri

| Login | Dashboard |
|-------|-----------|
| ![Login](docs/screenshots/01-login.png) | ![Dashboard](docs/screenshots/02-dashboard.png) |

| Transactions | Swagger UI |
|--------------|------------|
| ![Transactions](docs/screenshots/03-transactions.png) | ![Swagger](docs/screenshots/04-swagger.png) |
```

---

## 8. Test ve lint sonucunu repo'ya kilitle

```bash
cd backend
npm test     2>&1 | tail -20  > ../docs/test-output.txt   # opsiyonel ama hoş
npm run lint
```

İkisi de yeşil bitmeli. Olmazsa **dur** ve çıktıyı bana getir.

---

## 9. Son commit + push

```bash
cd /Users/sertacakalin/Desktop/Projects/WalletLog/walletlog
git add .
git commit -m "docs: screenshots + ops checklist"
git push
```

(Opsiyonel) Teslim noktasını tag'le, sonradan kolay dön:
```bash
git tag -a v1.0.0 -m "Submission build"
git push --tags
```

---

## 10. Teslim ZIP'ini oluştur (Uzem upload'u)

Grader `node_modules/` veya `.env`'i ZIP içinde **istemez**.

```bash
cd /Users/sertacakalin/Desktop/Projects/WalletLog
zip -r WalletLogSAD-Sertac.zip walletlog \
  -x "walletlog/backend/node_modules/*" \
  -x "walletlog/backend/.env" \
  -x "walletlog/.git/*" \
  -x "walletlog/**/.DS_Store"
```

Doğrula:
```bash
unzip -l WalletLogSAD-Sertac.zip | grep -E "node_modules|\.env$"
# beklenen: hiçbir eşleşme olmamalı
unzip -l WalletLogSAD-Sertac.zip | head -30
# beklenen: backend/, frontend/, README.md vb.
```

---

## 11. Sunum hazırlığı (offline yapabileceklerin)

- Sunum başlamadan **Postgres ve dev server zaten ayakta** olsun.
- **İki tarayıcı penceresi açık tut** — biri Deniz'le giriş yapmış, diğeri Ali'yle —
  arasında geçiş yaparak kullanıcı izolasyonunu göster.
- **Üçüncü sekmede Swagger** olsun. Önce Swagger üzerinden login → **Authorize** →
  access token'ı yapıştır → her endpoint'i tek tıkla tetikle.
- Layered kodu göstermeye hazır ol: `routes/transactionRoutes.js` →
  `services/transactionService.js` → `models/transactionModel.js` —
  üç dosya, üç sorumluluk.
- Test: `npm test` canlı koş → 7 suite, 104 passing.

---

## 12. "Teslim edildi" tanımı

- [ ] GitHub'da `WalletLogSAD` reposu `main`'de tüm kodu gösteriyor
- [ ] GitHub'da CI badge yeşil (push'ta lint + test geçti)
- [ ] Temiz bir clone'da `npm install` + DB reset + `npm run dev` çalışıyor
- [ ] Swagger Authorize her korumalı endpoint'te işliyor
- [ ] İki tarayıcı oturumu User A'nın User B'nin verisini göremediğini kanıtlıyor
- [ ] Ekran görüntüleri commit'lendi ve GitHub README'sinde render oluyor
- [ ] ZIP Uzem'e yüklendi, içinde `node_modules` ve `.env` yok
- [ ] (Opsiyonel) `v1.0.0` tag'i teslim noktasını işaretliyor

8 kutu da işaretliyse iş bitti. Bir adımda bir şey beklediğin gibi
çalışmazsa haber ver.
