# Kafile Yönetim Sistemi - Canlı Dağıtım ve Yayınlama Rehberi (Production Deployment Guide)

Bu rehber, **Kafile Yönetim Sistemi**'nin **Supabase (PostgreSQL / Auth)** ve **Vercel (Serverless Nuxt SSR)** üzerinde sıfırdan canlıya (Production) alınması için gereken 10 temel adımı eksiksiz olarak açıklar.

---

## 1. Supabase Proje Kurulumu ve Bölge Seçimi

1. **Hesap ve Proje Açılışı:**
   - [supabase.com](https://supabase.com) adresine giriş yapın ve **New Project** butonuna tıklayın.
   - Organizasyonunuzu seçin ve proje adını belirleyin (Ör. `kafile-yonetim-prod`).
2. **Güçlü Veritabanı Parolası:**
   - En az 16 karakterli, büyük/küçük harf, rakam ve sembol içeren güçlü bir veritabanı parolası oluşturun. Bu parolayı güvenli bir parola yöneticisinde saklayın.
3. **Bölge (Region) Eşleştirmesi ve Gecikme Optimizasyonu (ÖNEMLİ):**
   - Türkiye ve Avrupa'dan erişimlerde en düşük gecikme (latency) ve yüksek performans için:
     - **Supabase Bölgesi:** `Frankfurt (eu-central-1)`
     - **Vercel Bölgesi:** `Frankfurt, Germany (fra1)`
   - Sunucu ve veritabanının aynı veri merkezinde (Frankfurt) konumlandırılması, sunucusuz (serverless) sorgu yanıt sürelerini 5ms altına indirir.

---

## 2. Ortam Değişkenleri ve Temin Edilecek Yerler

Uygulamada kullanılan ortam değişkenleri **Server-Only (Gizli)** ve **Public (Genel)** olarak ikiye ayrılır:

### A. Server-Only (Gizli / Private - Yalnızca Sunucu Tarafı)
Bu anahtarlar tarayıcıya veya Nuxt `public` runtime config içine **kesinlikle sızdırılmaz**.

| Değişken Adı | Açıklama | Nereden Alınır? |
|:---|:---|:---|
| `DATABASE_URL` | Supabase **Transaction Pooler** URL (Port `6543`, `?pgbouncer=true`). Vercel serverless çalışma zamanında PostgreSQL bağlantı havuzunun tükenmesini önler. | Supabase Dashboard &rarr; **Project Settings** &rarr; **Database** &rarr; **Connection string** &rarr; *Transaction* seçeneği. |
| `DIRECT_URL` | Supabase **Session Pooler / Doğrudan Bağlantı** URL (Port `5432`). Şema migration (`prisma migrate deploy`) ve DDL işlemleri için gereklidir. IPv4 uyumluluğu için pooler üzerindeki 5432 portu kullanılır. | Supabase Dashboard &rarr; **Project Settings** &rarr; **Database** &rarr; **Connection string** &rarr; *Session* seçeneği. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin yetkisine sahip secret token. Yalnızca sunucu API'lerinde yetki doğrulaması için kullanılır. | Supabase Dashboard &rarr; **Project Settings** &rarr; **API** &rarr; **Project API keys** &rarr; `service_role` (secret). |

### B. Public (İstemci Tarafında Erişilebilir Genel Değişkenler)
Nuxt `public` runtime config üzerinden tarayıcıya güvenle aktarılabilir.

| Değişken Adı | Açıklama | Nereden Alınır? |
|:---|:---|:---|
| `SUPABASE_URL` | Supabase REST ve Auth API uç noktası (`https://[PROJECT-REF].supabase.co`). | Supabase Dashboard &rarr; **Project Settings** &rarr; **API** &rarr; *Project URL*. |
| `SUPABASE_ANON_KEY` | İstemci tarafı oturum kontrolü için genel `anon` anahtarı. | Supabase Dashboard &rarr; **Project Settings** &rarr; **API** &rarr; **Project API keys** &rarr; `anon` (public). |

### C. Uygulama Ayarları
- `TZ="Europe/Istanbul"` (Operasyonel saat dilimi Europe/Istanbul UTC+3 olarak sabitlenir).
- `NODE_ENV="production"`

---

## 3. Migration Uygulama ve Veritabanı İzinleri (RLS)

### A. Üretim Migration Çalıştırma
Canlı veritabanı şemasını oluşturmak ve güncellemek için lokal terminalinizden veya güvenli bir CI/CD adımından şu komut çalıştırılır:

```bash
npx prisma migrate deploy
```

> [!IMPORTANT]
> `prisma migrate deploy` komutu `prisma/migrations` altındaki SQL dosyalarını sırasıyla uygular ve `_prisma_migrations` tablosunda durumunu saklar. Build sırasında asla otomatik migration çalıştırılmaz.

### B. Row Level Security (RLS) ve Tablo Yetkilerinin Kapatılması
Sistemde tüm veri erişimi Nuxt sunucu katmanı (`/server/api/...`) üzerinden denetlenir. Tarayıcı istemcilerinin Supabase PostgREST Data API üzerinden doğrudan tablolara erişmesini engellemek için Supabase **SQL Editor** üzerinden şu script çalıştırılmalıdır:

```sql
-- 1. İş tablolarında RLS aktifleştirme
ALTER TABLE "AppUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VehicleOwner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Convoy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

-- 2. anon ve authenticated rollerinin doğrudan tablo erişimini tamamen iptal etme
REVOKE ALL ON "AppUser" FROM anon, authenticated;
REVOKE ALL ON "VehicleOwner" FROM anon, authenticated;
REVOKE ALL ON "Bus" FROM anon, authenticated;
REVOKE ALL ON "Convoy" FROM anon, authenticated;
REVOKE ALL ON "Trip" FROM anon, authenticated;
REVOKE ALL ON "Payment" FROM anon, authenticated;
```

---

## 4. İlk Yönetici (Auth & AppUser) Hesabı Kurulumu

Sistemde herkese açık kayıt kapalıdır. İlk yönetici hesabı 2 aşamalı olarak tanımlanır:

### Adım 1: Supabase Auth Üzerinde Kullanıcı Oluşturma
1. Supabase Dashboard &rarr; **Authentication** &rarr; **Users** sekmesine gidin.
2. Sağ üstteki **Add user** &rarr; **Create user** butonuna tıklayın.
3. Yönetici e-posta adresini (ör. `admin@kafile.com`) ve güçlü bir parola girin.
4. **Auto Confirm User?** seçeneğini işaretleyin (onay e-postası beklemeden anında aktifleşir).
5. Kullanıcı oluştuktan sonra tablodaki **User UID** değerini (UUID formatında, ör. `00bf6038-2f9c-47dd-9431-5204a2dcac0b`) kopyalayın.

### Adım 2: `AppUser` Tablosunda Yetkilendirme
Kopyaladığınız `User UID` ile Supabase **SQL Editor** sekmesinde şu sorguyu çalıştırın:

```sql
INSERT INTO "AppUser" ("id", "displayName", "isActive", "createdAt")
VALUES ('[KOPYALANAN-USER-UID]', 'Sistem Yöneticisi', true, NOW())
ON CONFLICT ("id") DO UPDATE SET "isActive" = true;
```

*(Opsiyonel)*: Geliştirme ortamında hazır yönetici oluşturmak için `npx tsx scripts/create-admin.ts` komutu da kullanılabilir.

---

## 5. Git Deposu Hazırlığı

1. **Gizli Dosyaları Kontrol Edin:**
   `.gitignore` dosyasının `.env`, `.env.*`, `node_modules`, `.output`, `.nuxt` girdilerini içerdiğinden ve hiçbir `.env` dosyasının git geçmişine eklenmediğinden emin olun:
   ```bash
   git status
   ```
2. **Değişiklikleri Commit ve Push Edin:**
   ```bash
   git add .
   git commit -m "feat: production deployment preparation"
   git push origin main
   ```

---

## 6. Vercel Proje İçe Aktarma ve Build Ayarları

1. [vercel.com](https://vercel.com) Dashboard'una gidin ve **Add New...** &rarr; **Project** seçin.
2. GitHub / GitLab / Bitbucket üzerindeki `menziltakip` deposunu seçerek **Import** butonuna tıklayın.
3. **Build and Output Settings:**
   - **Framework Preset:** `Nuxt.js` (Otomatik algılanır)
   - **Root Directory:** `./`
   - **Build Command:** `npm run build` (veya varsayılan bırakın; `package.json` içindeki `"prisma generate && nuxt build"` komutu çalışır)
   - **Output Directory:** `.output`
   - **Install Command:** `npm install` (veya `npm ci`)
4. **Node.js Sürümü:**
   - Vercel Project Settings &rarr; **General** &rarr; **Node.js Version** alanında `20.x` veya `22.x` seçili olduğunu doğrulayın (`package.json` içindeki `"engines": { "node": ">=20.0.0" }` kuralı ile tam uyumludur).

---

## 7. Production ve Preview Ortam Değişkenleri Stratejisi

> [!CAUTION]
> **ÖNEMLİ:** Vercel **Preview** ortamları (Pull Request ve geliştirme branch'leri) **ASLA canlı Production veritabanına bağlanmamalıdır.**

Vercel **Settings** &rarr; **Environment Variables** ekranında değişkenleri eklerken ortam kutucuklarını şu şekilde ayırın:

1. **Production Ortamı İçin:**
   - `DATABASE_URL`: Canlı Supabase Transaction Pooler URL
   - `DIRECT_URL`: Canlı Supabase Session URL
   - `SUPABASE_URL`: Canlı Supabase Proje URL
   - `SUPABASE_ANON_KEY`: Canlı Supabase Anon Key
   - `SUPABASE_SERVICE_ROLE_KEY`: Canlı Supabase Service Role Key
   - `TZ`: `Europe/Istanbul`
   - Ortam Seçimi: Yalnızca **[x] Production** işaretleyin.

2. **Preview & Development Ortamı İçin:**
   - Supabase üzerinde ikinci bir proje açın (ör. `kafile-yonetim-staging`) veya Supabase Database Branching özelliğini kullanın.
   - Bu ortama staging veritabanının `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` değerlerini girin.
   - Ortam Seçimi: **[x] Preview** ve **[x] Development** işaretleyin.

---

## 8. Supabase Auth Site URL ve Redirect URL Yapılandırması

Supabase Dashboard &rarr; **Authentication** &rarr; **URL Configuration** sekmesine gidin:

1. **Site URL:**
   - Canlı Vercel domaininizi girin: `https://[proje-adiniz].vercel.app` (veya özel alan adınız: `https://panel.kafile.com`)
2. **Redirect URLs (Allow List):**
   Aşağıdaki yönlendirme şablonlarını ekleyin:
   - `https://[proje-adiniz].vercel.app/**`
   - `https://*.vercel.app/**` (Preview ortamları için)
   - `http://localhost:3000/**` (Lokal test için)
3. Değişiklikleri **Save** butonuna basarak kaydedin.

---

## 9. Yayın Sonrası Kontroller (Post-Deployment Smoke Test)

Dağıtım tamamlandıktan sonra canlı URL üzerinde şu kontrolleri sırayla doğrulayın:

1. **Giriş Ekranı (`/login`):**
   - Sayfa sorunsuz yükleniyor mu?
   - Yanlış parola girildiğinde Türkçe hata mesajı çıkıyor mu?
   - Doğru yönetici bilgileriyle giriş yapıldığında `/` adresine yönleniyor mu?
2. **Gösterge Paneli (`/`):**
   - KPI kartları ve istatistikler doğru hesaplanıyor mu?
   - İstanbul saatine göre gün sınırları doğru filtreleniyor mu?
3. **Temel CRUD Akışları:**
   - Bir araç sahibi ve 46 kişilik otobüs eklenebiliyor mu?
   - Bir sefer oluşturulup durumu `PLANNED` &rarr; `ON_ROAD` &rarr; `COMPLETED` olarak ilerletilebiliyor mu?
4. **Finans ve Bakiye:**
   - Sefere ödeme eklendiğinde kalan borç ve ödeme rozeti anında güncelleniyor mu?
5. **CSV Dışa Aktarma:**
   - Seferler listesinde filtre uygulayıp "CSV İndir" butonuna basıldığında dosya UTF-8 BOM ile Türkçe karakterleri bozulmadan iniyor mu?
6. **Güvenlik Başlıkları:**
   - Tarayıcı Network sekmesinde API yanıtlarının `Cache-Control: private, no-cache, no-store, must-revalidate` başlığını içerdiği doğrulanmalıdır.

---

## 10. Uygulama Sürümü Geri Alma (Rollback) ve Migration Riskleri

### A. Uygulama Kodu Geri Alma (Instant Rollback)
Vercel Dashboard &rarr; **Deployments** sekmesinden daha önce başarıyla çalışan herhangi bir dağıtımın yanındaki üç noktaya tıklayarak **Promote to Production** seçeneğiyle saniyeler içinde eski sürüme dönülebilir.

### B. Veritabanı Migration Riskleri ve Önlemleri
1. **Geriye Dönük Uyumluluk (Backward Compatibility):**
   - Veritabanı migration'larında mevcut bir sütunu doğrudan silmek (`DROP COLUMN`) veya adını değiştirmek (`RENAME COLUMN`), eski sürüm kodun hata vermesine yol açar.
   - Değişiklikler her zaman 2 aşamalı yapılmalıdır: Önce yeni sütun eklenmeli, kod canlıya alındıktan sonra eski sütun kaldırılmalıdır.
2. **Geri Alma (Rollback) Migration'ları:**
   - Geri alınması gereken bir migration durumunda doğrudan veritabanında elle tablo silinmemelidir.
   - Yeni bir ters migration dosyası hazırlanarak (`npx prisma migrate dev --name revert_feature`) `prisma migrate deploy` ile uygulanmalıdır.
3. **Yedekleme (Backup):**
   - Canlıya çıkış veya büyük şema güncellemeleri öncesinde Supabase Dashboard &rarr; **Project Settings** &rarr; **Database** &rarr; **Backups** sekmesinden manuel yedek (snapshot) alınmalıdır.
