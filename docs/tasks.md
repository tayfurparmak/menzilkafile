# Kafile Yönetim Sistemi - Görev Listesi ve Aşama Planı (STATE 00–12)

Bu doküman, projenin sıfırdan canlıya alınmasına kadar olan tüm aşamalarını **STATE 00–12** metodolojisiyle adım adım tanımlar.

---

### [x] STATE 00: Proje İncelemesi, Mimari Analiz ve Dokümantasyon
- [x] Mevcut çalışma dizininin taranması ve dosya yapısının analiz edilmesi.
- [x] Temel mimari dokümanlarının hazırlanması:
  - `docs/requirements.md` (Kapsam, akışlar ve iş kuralları)
  - `docs/tech-stack.md` (Teknoloji yığını ve sürüm seçim ilkeleri)
  - `docs/data-model.md` (Veri modelleri, ilişkiler ve kısıtlar)
  - `docs/ui-spec.md` (Ekranlar, formlar ve görsel kurallar)
  - `docs/acceptance-criteria.md` (Ölçülebilir kabul koşulları)
  - `docs/tasks.md` (STATE 00–12 görev matrisi)
  - `docs/project-state.md` (Durum takip dosyası)
  - `docs/deployment.md` (Yayınlama rehberi)
- [x] Dokümanlar arası tutarlılığın doğrulanması.

---

### [x] STATE 01: Çekirdek Paketler ve UI Altyapısı
- [x] Nuxt 4 (`4.6.2`) ve Vue 3 (`3.5.44`) Composition API yapılandırması.
- [x] TypeScript (`5.8.2`), `vue-tsc` (`3.3.13`), typecheck ve lint komutlarının (`npm run typecheck`, `npm run lint`) hazırlanması.
- [x] Tailwind CSS (`@nuxtjs/tailwindcss 6.14.0`) kurulumu, açık arka plan (`#f8fafc`) ve yeşil vurgu (`#16a34a` / `emerald-600`) renk paletinin uygulanması.
- [x] Tek paket yöneticisi (`npm`) seçimi ve deterministik `package-lock.json` oluşturulması.
- [x] Masaüstü sol menü (sidebar) ve mobil açılır menü (drawer) içeren `default.vue` layout mimarisi.
- [x] Ortak ve yeniden kullanılabilir UI bileşenlerinin tamamlanması:
  - `AppButton.vue` (varyantlar: primary, secondary, danger, outline, ghost; yükleniyor ikonu)
  - `AppInput.vue` (etiket, hata ve ipucu desteği olan form alanı)
  - `AppEmptyState.vue` (boş durum görsel ve aksiyon bileşeni)
  - `AppErrorAlert.vue` (hata kutusu ve kapatma desteği)
  - `StatusBadge.vue` (sefer durum rozetleri)
  - `PaymentStatusBadge.vue` (ödenme durumu rozetleri)
  - `ConfirmModal.vue` (onay ve silme modalı)
- [x] Sayfa iskeletleri ve Türkçe arayüz:
  - Giriş sayfası görsel iskeleti (`/login`)
  - Gösterge paneli (`/`)
  - Araç sahipleri (`/owners`, `/owners/[id]`)
  - Otobüsler (`/buses`, `/buses/[id]`)
  - Kafileler (`/convoys`, `/convoys/[id]`)
  - Seferler (`/trips`, `/trips/new`, `/trips/[id]`)
- [x] Sahte / uydurma istatistik yerine gerçek boş durumlar (`AppEmptyState`) kullanımı.
- [x] Backend API rotaları için `server/api/...` yapısının kurulması.
- [x] Geliştirme sunucusu ve production derlemesi (`npm run build`) doğrulaması.

---

### [x] STATE 02: Prisma 6 Şeması ve Supabase Veritabanı Modelleri
- [x] `prisma/schema.prisma` dosyasının tanımlanması (`AppUser`, `VehicleOwner`, `Bus`, `Convoy`, `Trip`, `Payment`).
- [x] Kapasite kısıtının veritabanı seviyesinde CHECK kısıtı ile uygulanması (`capacity IN (41, 46, 54)`).
- [x] Parasal alanların `Decimal(12, 2)` ve pozitiflik kısıtlarıyla (`agreedAmount >= 0`, `amount > 0`) yapılandırılması.
- [x] Sefer bitişinin başlangıçtan sonra olması kuralı (`endsAt > startsAt`).
- [x] Zaman alanlarının saat dilimi destekli UTC `DateTime` (`TIMESTAMP(3)`) olarak saklanması.
- [x] Gerekli foreign key, composite index ve `onDelete: Restrict` ile cascade silinmeyi önleme kuralı.
- [x] Supabase Auth (`auth.users`) tablolarının Prisma dışında tutulması; `AppUser` modelinin bağımsız UUID ile eşleştirilmesi.
- [x] Sunucu katmanında singleton Prisma istemcisinin oluşturulması (`server/utils/prisma.ts`).
- [x] Runtime (`DATABASE_URL`, Port 6543) ve migration (`DIRECT_URL`, Port 5432) bağlantı rollerinin ayrıştırılması.
- [x] `.env.example` içine yalnızca yer tutucu şablon konulması ve `.env` dosyalarının `.gitignore` ile korunması.
- [x] `prisma/migrations/20261021000000_init/migration.sql` ilk migration dosyasının hazırlanması.
- [x] Supabase iş tablolarında Row Level Security (`ENABLE ROW LEVEL SECURITY`) ve tarayıcı erişimini engelleyen `REVOKE ALL ON ... FROM anon, authenticated;` kurallarının uygulanması.
- [x] Prisma bağlantı rolünün (`postgres` / `BYPASSRLS`) RLS davranışının ve sunucu doğrulamalarının dokümante edilmesi.

---

### [x] STATE 03: Supabase Auth ve Sunucu Tarafı Erişim Kontrolü
- [x] E-posta ve parola ile kimlik doğrulama, güvenli giriş (`/api/auth/login`) ve çıkış mekanizması.
- [x] Herkese açık kayıt ekranı ve uç noktasının bulunmaması (yalnızca yetkili iç kullanıcılar).
- [x] Nuxt SSR ile tam uyumlu cookie tabanlı oturum yönetimi (`sb-access-token`, `useCookie`).
- [x] Korunan sayfalar için küresel route middleware (`app/middleware/auth.global.ts`).
- [x] Korunan tüm API isteklerinde sunucuda oturumu doğrulayan ortak yardımcı (`server/utils/auth.ts` -> `requireAuthUser`).
- [x] Doğrulanmış Auth kullanıcısının veritabanında aktif `AppUser` kaydı olduğunun kontrolü (`isActive === true`).
- [x] İstemciden gelen userId veya rol parametrelerine güvenilmemesi; yetkinin yalnızca doğrulanmış imzalı token ve veritabanından alınması.
- [x] Kimliksiz isteklerde `401 Unauthorized`, aktif `AppUser` kaydı olmayan kullanıcılarda `403 Forbidden` yanıtı.
- [x] Süresi dolan oturum ve hatalı giriş denemeleri için Türkçe bilgilendirici hata mesajları.
- [x] Kullanıcıya özel API yanıtlarının ara önbelleklerde (CDN/Proxy) saklanmasını engelleyen `Cache-Control: private, no-cache, no-store, must-revalidate` ve `Pragma: no-cache` başlıkları.
- [x] Gizli anahtarların (`DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`) kesinlikle sunucu tarafında tutulması, `public` runtime config'e sızdırılmaması.
- [x] Hem uygulama arayüz sayfalarının hem de arka uç API uç noktalarının eksiksiz korunması.
- [x] İlk kullanıcı oluşturma adımlarının `docs/deployment.md` içine eklenmesi (Supabase Auth, aktif AppUser ekleme ve Redirect URL ayarları).

---

### [x] STATE 04: Araç Sahibi ve Otobüs Yönetimi (Vehicle Owners & Buses)
- [x] Araç Sahipleri:
  - Listeleme, arama (`name`, `phone`) ve sayfalama (`page`, `limit`).
  - Ekleme ve düzenleme modalı (`name` zorunlu, `phone` ve `notes` isteğe bağlı).
  - Aktif/pasif durum takibi ve ilişkili kayıt olduğunda fiziksel silme engeli (`ON DELETE RESTRICT` / pasife alma).
  - Detay ekranı (`/owners/[id]`): Kayıtlı otobüsler, tarihsel sefer geçmişi, toplam hakediş, ödenen ve kalan bakiye.
- [x] Otobüsler:
  - Listeleme, plakaya göre arama, araç sahibi, kapasite (41, 46, 54) ve aktiflik filtreleri.
  - Filtrelerin ve sayfalama durumunun URL query parametreleriyle (`search`, `ownerId`, `capacity`, `status`, `page`) senkronizasyonu.
  - Ekleme ve düzenleme modalı; pasif araç sahibine yeni otobüs atanmasının engellenmesi.
  - Koltuk kapasitesi seçeneklerinin yalnızca 41, 46 veya 54 olarak sınırlandırılması (Zod + DB check constraint).
  - Plaka normalizasyonu (`normalizePlate`): baştaki/sondaki ve aradaki boşlukları temizleme, Türkçe büyük harfe (`tr-TR`) çevirme.
  - Mükerrer plaka çakışmasında `409 Conflict` ve anlaşılır Türkçe hata mesajı.
  - Otobüs detay sayfası (`/buses/[id]`): Araç bilgileri, araç sahibi bağlantısı, sefer geçmişi ve yeni sefer başlatma aksiyonu.
  - Otobüs sahibinin değiştirilmesi durumunda eski seferlerin sahibi ve snapshot'larının korunması kuralı.
  - Formlarda çift gönderim koruması (`isSubmitting` kilidi) ve başarı bildirimleri.
  - Kapsamlı birim testleri (`tests/owners-buses.test.ts` ve `tests/business-rules.test.ts`).

---

### [x] STATE 05: Kafileler ve Seferlerin Atanması (Convoys & Trips Assignment)
- [x] Kafile İşlemleri:
  - Kafile oluşturma, düzenleme ve listeleme (`/convoys`, `/convoys/[id]`).
  - Aktif/pasif durumu ve bağlı seferlerin detay sayfasında görüntülenmesi.
  - Kafileye ait sefer bazlı toplam yolcu koltuk kapasitesi ve anlaşılan ücret özeti.
- [x] Sefer Oluşturma ve Atama:
  - Kafile seçimi isteğe bağlı (bağımsız sefer veya belirli kafileye bağlı).
  - Yalnızca aktif otobüs ve aktif araç sahibi seçimine izin verilmesi.
  - `ownerId` ve snapshot alanlarının (`plateSnapshot`, `capacitySnapshot`, `ownerNameSnapshot`) istemciden kabul edilmeyip sunucuda otobüs kaydından üretilmesi.
  - Başlangıç ve bitiş zamanı kontrolü (`endsAt > startsAt`).
  - Anlaşılan toplam sefer ücreti (TRY) ve notlar.
  - İlk durumun otomatik `PLANNED` olarak atanması.
- [x] Eşzamanlılık ve Çakışma (Overlap) Kuralları:
  - Yarı-açık `[başlangıç, bitiş)` zaman aralığı kuralı; bir sefer bittiği tam anda diğerinin başlamasına izin verilir.
  - Eşzamanlı isteklerde yarış durumunu (race condition) önlemek için transaction içinde `SELECT id FROM "Bus" WHERE id = $1 FOR UPDATE;` satır kilitleme stratejisi.
  - Çakışma durumunda `409 Conflict` ve kullanıcıya anlaşılır Türkçe saat detaylı hata mesajı.
- [x] Sefer Güncelleme ve Tarihsel Koruma:
  - Planlanmış (`PLANNED`) seferler güncellenebilir.
  - Sefer başladıktan sonra (`ON_ROAD` veya `COMPLETED`) otobüs ve tarihsel sahip değiştirilemez.
  - Planlanan seferde otobüs değişirse snapshot alanları sunucuda yeni araç bilgileriyle yeniden üretilir.
  - Otobüsün sahibi devredilse veya değişse bile geçmiş sefer snapshot'ları ve mali kayıtları korunur.
- [x] Saat Dilimi ve Ön Seçim:
  - Formdaki saatlerin `Europe/Istanbul` (UTC+3) kabul edilip UTC'ye dönüştürülmesi (`parseIstanbulDateInput`).
  - Otobüs detay sayfasından (`/buses/[id]`) doğrudan önceden seçili otobüs parametresiyle (`/trips/new?busId=...`) yeni sefer oluşturulabilmesi.
- [x] Kapsamlı testler (`tests/trips-convoys.test.ts` ve `tests/business-rules.test.ts`).

---

### [x] STATE 06: Sefer Listesi, Detay Ekranı ve Güvenli Durum Geçişleri
- [x] Sefer Listesi ve Filtreleme (`/trips`):
  - Plaka ve tarihsel araç sahibi (`plateSnapshot`, `ownerNameSnapshot`, `capacitySnapshot`).
  - Kafile, kalkış ve varış noktaları, başlangıç ve bitiş tarihleri, anlaşılan ücret, ödenen, kalan borç ve durum rozetleri.
  - Detaya git işlemi (`/trips/[id]`).
  - Filtreler: Tarih aralığı (`startDate`, `endDate`), plaka (`plate`), araç sahibi (`ownerId`), kafile (`convoyId`), sefer durumu (`status`), ödeme durumu (`paymentStatus`).
  - Sunucu tarafı filtreleme, sayfalama ve filtrelerin URL query parametrelerinde senkronize korunması (`router.replace`).
  - Sıralama alanlarının sunucuda Zod allowlist ile sınırlandırılması (`sortBy`: `startsAt`, `endsAt`, `agreedAmount`, `createdAt`; `sortOrder`: `asc`, `desc`).
- [x] Güvenli Durum Akışı:
  - İzin verilen geçişler: `PLANNED → ON_ROAD`, `PLANNED → CANCELLED`, `ON_ROAD → COMPLETED`, `ON_ROAD → CANCELLED`.
  - Terminal (son) durumlar: `COMPLETED` ve `CANCELLED` son durumdur; hiçbir duruma geçiş yapılamaz.
  - Geçersiz geçişlerin hem UI seviyesinde hem API seviyesinde (`400 Bad Request`) engellenmesi (`canTransitionTripStatus`).
  - Fiziksel silme yerine iptal zorunluluğu (`DELETE /api/trips/[id]` işlemi `400 Bad Request` ile engellenir ve iptal yönlendirmesi yapar).
  - Ödemesi bulunan (`paymentCount > 0`) seferlerin iptalinin engellenmesi (`400 Bad Request` + arayüzde bilgilendirme).
  - İptal işleminde onay penceresi (`ConfirmModal`) ile doğrulama istenmesi.
  - Eşzamanlı güncellemelerin güvenli ele alınması: Transaction içinde `SELECT id, status FROM "Trip" WHERE id = $1 FOR UPDATE;` satır kilitleme ve istemcinin gönderdiği `currentStatus` ile DB durumu uyuşmadığında `409 Conflict` fırlatılması.
- [x] Sefer Detay Ekranı (`/trips/[id]`):
  - Araç, dondurulmuş tarihsel araç sahibi, güzergâh, başlangıç/bitiş tarihleri, anlaşılan ücret, durum rozeti, ödeme özeti, yapılan ödemeler tablosu ve notlar.
  - Durum aksiyon butonları (`Seferi Başlat`, `Seferi Tamamla`, `Seferi İptal Et`), terminal durum rozetleri ve ödeme silme/ekleme akışları.
- [x] Mobil Uyumluluk, Boş Durumlar ve Hata Yönetimi:
  - Mobil kart görünümü, `AppEmptyState`, hata uyarıları ve 409 eşzamanlılık uyarısında otomatik yenileme.
- [x] Otomatik Testler:
  - `tests/trip-status-flow.test.ts` (14/14 test başarılı; geçerli/geçersiz geçişler, son durumlar, ödeme iptal engeli, 409 stale conflict ve sıralama allowlist doğrulaması).

---

### [x] STATE 07: Araç Sahibine Yapılan Sefer Bazlı Ödemelerin Takibi
- [x] Sefer Detay Ekranı Ödeme Bölümü (`/trips/[id]`):
  - Anlaşılan toplam ücret (`agreedAmount`) ve ücret düzenleme modalı.
  - Yapılan ödemeler toplamı (`totalPaid`).
  - Kalan borç tutarı (`remainingAmount`).
  - Dinamik ödeme durumu rozeti (`PaymentStatusBadge`: Ödenmedi, Kısmi ödendi, Tamamı ödendi, Ödeme gerekmiyor).
  - Ödeme hareketleri listesi (Ödeme tarihi, tutar, ödeme yöntemi: Banka Havalesi veya Nakit, dekont/açıklama notu).
  - Ödeme ekleme, düzenleme ve onay pencereli silme (`ConfirmModal`).
- [x] Ödeme API Uç Noktaları & İş Kuralları:
  - `POST /api/payments`: Yeni ödeme ekleme.
  - `PUT /api/payments/[id]`: Mevcut ödemeyi düzenleme.
  - `DELETE /api/payments/[id]`: Ödemeyi onay ile silme.
  - Tutar sıfırdan büyük olmalıdır (`amount > 0`).
  - İptal edilmiş (`CANCELLED`) sefere ödeme eklenemez ve düzenlenemez (`400 Bad Request`).
  - Toplam ödeme sefer ücretini aşamaz (kalan borcu aşan tutarlar reddedilir).
  - Sefer ücreti, mevcut ödemeler toplamının altına düşürülemez (`PUT /api/trips/[id]`).
  - Ödeme düzenlerken düzenlenen ödemenin tutarı hesaba katılarak azami sınır belirlenir (`maxAllowed = agreed - otherPaymentsTotal`).
  - Eşzamanlı ödeme ve ücret değişikliklerini korumak için transaction içinde `SELECT id, "agreedAmount", status FROM "Trip" WHERE id = $1 FOR UPDATE;` satır kilitleme stratejisi.
  - Veritabanında `Decimal(12, 2)` kullanılır, API yanıtlarında parasal tutarlar string olarak taşınır.
  - JavaScript floating-point yuvarlama hatalarını önlemek için tüm hesaplamalarda `Decimal.js` kullanılır.
  - Kalan tutar ve ödeme durumu veritabanında ayrı bir sütunda saklanmaz; her sorguda dinamik türetilir.
- [x] Sefer Listesi ve Filtre Entegrasyonu (`/trips`):
  - Listede Anlaşılan Ücret, Ödenen ve Kalan Borç sütunları.
  - Ödeme durumu filtresi (`paymentStatus`: `ALL`, `UNPAID`, `PARTIALLY_PAID`, `PAID`, `NO_PAYMENT_REQUIRED`) ve URL query senkronizasyonu.
- [x] Otomatik Testler:
  - `tests/trip-payments.test.ts` (16/16 test başarılı: 18.000 TL + 5.000 TL = 13.000 TL kalan kabul örneği, 2. 13.000 TL ile kalan 0, ek ödeme reddi, iptal sefer koruması, ücret düşürme sınırı, ödeme düzenleme sınırı, dinamik 4 durum türetimi, kuruş hassasiyeti).

---

### [x] STATE 08: Gösterge Paneli ve Detay Raporlama (Dashboard & Reports)
- [x] Operasyon Gösterge Paneli (`/`, `/api/dashboard`):
  - Aktif otobüs sayısı (`activeBusesCount`).
  - İstanbul saat dilimine göre bugün başlayan, iptal edilmemiş seferler (`todayTripsCount`, `getIstanbulDayRange`).
  - Yoldaki aktif seferler (`onRoadTripsCount`).
  - Seçilen dönemdeki toplam anlaşılan sefer ücreti (`totalAgreedAmount`).
  - Yalnızca bu dönem seferlerine bağlı ödeme toplamı (`totalPaidAmount`).
  - Bu dönem seferlerinin kalan borcu (`totalRemainingAmount`).
  - İptal edilmiş seferlerin mali toplamlardan tamamen çıkarılması.
  - Mali hesaplamanın anlamının ekranda açık ve anlaşılır şekilde belirtilmesi.
  - Yaklaşan seferler (en yakın 5 sefer) ve ödeme bekleyen seferler (kalan borcu olanlar).
- [x] Araç Sahibi Detay Raporlaması (`/owners/[id]`, `/api/owners/[id]`):
  - Güncel kayıtlı otobüsler listesi.
  - Tarihsel olarak kendisine ait seferler (geçmiş snapshot'lar ve dondurulmuş veriler).
  - Dönemlik filtreleme (`startDate`, `endDate`) ve döneme ait ücret, ödeme ve kalan borç toplamları.
- [x] Kafile Detay Raporlaması (`/convoys/[id]`, `/api/convoys/[id]`):
  - Bağlı seferler ve sefer sayısı.
  - Benzersiz otobüs sayısı (`uniqueBuses.size`).
  - Sefer bazında toplam koltuk kapasitesi (terminoloji kuralı: asla "yolcu sayısı" olarak adlandırılmaz).
  - Kafile bazında anlaşılan ücret, yapılan ödemeler ve kalan borç toplamları.
- [x] Performans ve Mimari:
  - Mali toplamların sayfalanmış listeden değil, filtrelenen tüm kayıtlar üzerinden sunucuda hesaplanması.
  - N+1 sorgularından kaçınma (tek seferde ilişkili ödeme ve kafile select/include kullanımı).
  - Ödeme veya sefer durumu güncellendiğinde özetlerin anında dinamik yenilenmesi.
- [x] Otomatik Testler:
  - `tests/dashboard-reporting.test.ts` (9/9 test başarılı).

---

### [x] STATE 09: Kullanıcı Arayüzü İyileştirmeleri ve CSV Dışa Aktarımı (UI Polish & CSV Export)
- [x] Tüm Ekranlarda UI Tutarlılığı ve Türkçe Terminoloji:
  - Form etiketleri ve alan bazlı açıklayıcı Türkçe hata mesajları.
  - Yükleniyor (`isLoading` spinner), boş liste (`AppEmptyState`), hata ve başarı bildirimleri.
  - Kaydetme ve işlem sırasında butonların kilitlenmesi (`isSubmitting`, `isSavingPayment`, `isExportingCsv`).
  - İptal, silme ve durum değişikliklerinde onay modalı (`ConfirmModal`) ve klavye desteği (`Escape` tuşu).
  - Klavye erişimi ve görünür odak (`focus-visible` ring stilleri).
  - Masaüstü sol menü, mobilde açılır drawer menü, mobil form ve kart görünümleri.
  - Tüm sayfalarda `tr-TR` ve TRY para birimi formatı (`formatMoney`: `18.000,00 ₺`).
  - Tarih ve saat gösteriminde `Europe/Istanbul` desteği (`formatIstanbulDateTime`).
  - Tüm liste ekranlarında (Seferler, Araç Sahipleri, Otobüsler, Kafileler) "Filtreleri Temizle" aksiyonu ve ortak `AppPagination` bileşeni.
  - Uzun metin ve notlarda taşma koruması (`truncate`, `break-words`).
  - Kapasite terminolojisi kuralı: Asla "yolcu sayısı" olarak adlandırılmaz, "Koltuk Kapasitesi" / "Sefer Bazında Toplam Kapasite" olarak tutarlı kullanılır.
- [x] Sefer Listesi CSV Dışa Aktarma (`/api/trips?format=csv`):
  - Aktif tüm filtrelerin tamamını (tarih aralığı, plaka, araç sahibi, kafile, sefer durumu, ödeme durumu, sıralama kriteri ve yönü) sunucuda uygular.
  - Yalnızca görünen sayfayı değil, tüm filtrelenmiş sonuçları dışa aktarır (`skip: 0`, `take: 5000`).
  - Sunucu tarafında oturum ve yetki kontrolü (`requireAuthUser(event)`).
  - Excel ve üçüncü parti tablolarda Türkçe karakterlerin bozulmaması için UTF-8 BOM (`\uFEFF`) eklenmesi.
  - CSV standart kaçış kuralları (çift tırnak kaçışları, noktalı virgül delimiter).
  - Kullanıcı girdilerinde spreadsheet formula injection riskinin engellenmesi (`=`, `+`, `-`, `@` ve boşluklu varyasyonları tek tırnakla nötralize etme).
  - Büyük çıktılarda sınırsız bellek ve sunucu yükünü önlemek için 5.000 satır tavan sınırı.
  - Arayüzde CSV indirme esnasında butonun kilitlenmesi ve yükleniyor animasyonu (`isExportingCsv`).
- [x] Otomatik Testler:
  - `tests/csv-export-ui.test.ts` (6/6 test başarılı; CSV formül enjeksiyonu koruması, çift tırnak kaçışı, UTF-8 BOM ve Türkçe karakter bütünlüğü).

---

### [x] STATE 10: Yayın Öncesi Doğrulama ve Kabul Kriterleri Doğrulaması (Pre-Deployment Verification)
- [x] Komut ve Çıktı Doğrulamaları:
  - `npm run typecheck` (0 hata).
  - `npm run lint` (0 hata).
  - `npm test` (8 test dosyası, 85/85 test başarılı).
  - `npm run build` (`owners/[id].vue` ve `index.vue` şablon kapanış hataları düzeltildi, `.output/server` derlemesi 8.57s içinde sıfır hatayla üretildi).
- [x] 12 Temel İş Kuralı Doğrulaması:
  - 1. Mükerrer normalize plaka reddi (409 Conflict)
  - 2. Kapasite yalnızca 41/46/54 (Zod & DB Check kısıtı)
  - 3. Çakışan seferler reddi ([başlangıç, bitiş) zaman aralığı)
  - 4. Eşzamanlı çakışan sefer kayıtları (PostgreSQL SELECT FOR UPDATE satır kilidi)
  - 5. Araç sahibi değişince geçmiş sefer korunması (ownerNameSnapshot, plateSnapshot dondurma)
  - 6. Geçersiz durum geçişleri reddi (PLANNED -> COMPLETED geçersiz; COMPLETED/CANCELLED nihai)
  - 7. Fazla ödeme ve eşzamanlı fazla ödeme engeli (Decimal.js, kalan borcu aşan tutarların reddi, satır kilidi)
  - 8. Ücret mevcut ödemenin altına düşürülemez (agreedAmount < totalPaid engeli, 400 Bad Request)
  - 9. Ödemesi olan sefer iptal edilemez (paymentCount > 0 durumunda CANCELLED engeli)
  - 10. Kimliksiz ve yetkisiz API engeli (Token doğrulama, süresi dolmuş token reddi, aktiflik kontrolü)
  - 11. İstanbul saatinde gün sınırları (Europe/Istanbul 00:00:00+03:00 - 23:59:59.999+03:00)
  - 12. Filtrelenmiş mali toplamlar (Filtrelenen tüm seferlerden dinamik türetim)
- [ ] Canlı Tarayıcı Akışı ve Staging DB (Beklemede):
  - Otomatik Playwright alt ajanı Azure CDN 404 sürücü kısıtı nedeniyle tarayıcı başlatamadı.
  - Canlı Supabase üretim veritabanının kirletilmemesi kuralı uygulandı; ayrı staging DB sağlandığında veya yetkili kullanıcı tarafından manuel kabul testiyle tamamlanacak.
- [x] Doğrulama Raporu:
  - Çalıştırılan komutlar, gerçek sonuçlar, teknik engeller ve kalan yayın engelleri `docs/verification.md` dosyasında belgelendi.

---

### [x] STATE 11: Supabase Production ve Vercel Dağıtım Hazırlığı (Deployment Readiness)
- [x] Ortam Değişkenleri ve Güvenlik İzolasyonu:
  - `.env.example` güncellendi; değişkenler `SERVER-ONLY` (Private) ve `PUBLIC` olarak açıkça ayrıldı.
  - `DATABASE_URL` (Port 6543, `?pgbouncer=true` pooled) ve `DIRECT_URL` (Port 5432 session) rolleri tanımlandı.
  - `SUPABASE_SERVICE_ROLE_KEY` gizli tutuldu ve Nuxt public runtime config'e asla dahil edilmedi.
  - `.gitignore` ile `.env` ve `.env.*` dosyalarının git deposuna eklenmesi engellendi.
- [x] Prisma ve Nuxt Derleme Entegrasyonu:
  - `package.json` `"build"` komutuna `prisma generate` dahil edildi (`scripts/build.mjs`).
  - Nuxt `ssr: true` olarak tam sunuculu (SSR) yapılandırıldı; statik export kullanılmadı.
  - Node.js LTS uyumluluğu için `package.json` dosyasına `"engines": { "node": ">=20.0.0" }` eklendi.
  - Üretim migration komutu `npm run prisma:migrate` (`prisma migrate deploy`) olarak hazırlandı.
  - Derleme sırasında migration veya seed'in otomatik çalıştırılması engellendi.
- [x] Ortam İzolasyonu ve Güvenlik:
  - Vercel Preview ortamlarının canlı Production veritabanından izole edilmesi stratejisi belirlendi.
  - `prisma/seed.ts` dosyasına `NODE_ENV === 'production'`, `VERCEL` ve `VERCEL_ENV` kalkanları eklenerek canlı ortamda çalışması engellendi.
  - Supabase RLS ve PostgREST tablo yetkilerinin kapatılması SQL komutları hazırlandı.
- [x] Kapsamlı Dağıtım Rehberi (`docs/deployment.md`):
  - 10 bölümden oluşan eksiksiz canlıya alma, bölge eşleştirme (`eu-central-1` & `fra1`), ilk yönetici tanımlama, redirect URL yapılandırması, yayın sonrası testler ve rollback stratejisi yazıldı.
- [x] Production Build Doğrulaması:
  - `npm run build` ile `.output/server/index.mjs` ve `.output/public` sıfır hatayla derlendi.

---

### [x] STATE 12: Otomatik Testler, Doğrulama ve Vercel Hazırlığı
- [x] Vitest otomatik iş kuralı test paketlerinin hazırlanması ve 85/85 testin başarıyla koşulması.
- [x] Production build (`npm run build`) alınarak sıfır hata ile `.output/server` derlenmesi.
- [x] Vercel canlıya alma kılavuzunun (`docs/deployment.md`) hazırlanması.
